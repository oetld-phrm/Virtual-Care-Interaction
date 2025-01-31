import os
import json
import boto3
import psycopg2
import logging
from datetime import datetime, timezone
from typing import NamedTuple

from helpers.vectorstore import update_vectorstore
from langchain_aws import BedrockEmbeddings

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
DATA_INGESTION_BUCKET = os.environ["BUCKET"]
EMBEDDING_BUCKET_NAME = os.environ["EMBEDDING_BUCKET_NAME"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
EMBEDDING_MODEL_PARAM = os.environ["EMBEDDING_MODEL_PARAM"]

# AWS Clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm")
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Cached resources
connection = None
db_secret = None
EMBEDDING_MODEL_ID = None

# Set up class to represent parsed file path
class ParsedFilePath(NamedTuple):
    simulation_group_id: str
    patient_id: str 
    file_category: str
    file_name: str
    file_type: str

def get_secret():
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"]
            db_secret = json.loads(response)
        except Exception as e:
            logger.error(f"Error fetching secret {DB_SECRET_NAME}: {e}")
            raise
    return db_secret

def get_parameter():
    """
    Fetch a parameter value from Systems Manager Parameter Store.
    """
    global EMBEDDING_MODEL_ID
    if EMBEDDING_MODEL_ID is None:
        try:
            response = ssm_client.get_parameter(Name=EMBEDDING_MODEL_PARAM, WithDecryption=True)
            EMBEDDING_MODEL_ID = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {EMBEDDING_MODEL_PARAM}: {e}")
            raise
    return EMBEDDING_MODEL_ID

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret()
            connection_params = {
                'dbname': secret["dbname"],
                'user': secret["username"],
                'password': secret["password"],
                'host': RDS_PROXY_ENDPOINT,
                'port': secret["port"]
            }
            connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
            connection = psycopg2.connect(connection_string)
            logger.info("Connected to the database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            if connection:
                connection.rollback()
                connection.close()
            raise
    return connection

def parse_s3_file_path(file_key):
    # Assuming the file path is of the format: {simulation_group_id}/{patient_id}/{documents or info}/{file_name}.{file_type}
    try:
        # Split the path into components
        parts = file_key.split('/')
        
        # Validate that the path has the correct number of components
        if len(parts) != 4:
            raise ValueError(f"Unexpected file path format: {file_key}")

        simulation_group_id, patient_id, file_category, filename_with_ext = parts

        # Split filename and extension
        if '.' not in filename_with_ext:
            raise ValueError(f"Invalid filename format: {filename_with_ext}")

        file_name, file_type = filename_with_ext.rsplit('.', 1)

        return ParsedFilePath(
            simulation_group_id=simulation_group_id,
            patient_id=patient_id,
            file_category=file_category,
            file_name=file_name,
            file_type=file_type
        )
    except ValueError as e:
        logger.error(f"Error parsing S3 file path: {e}")
        return {
            "statusCode": 400,
            "body": json.dumps("Error parsing S3 file path.")
        }

def insert_file_into_db(patient_id, file_name, file_type, file_path, bucket_name):    
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {
            "statusCode": 500,
            "body": json.dumps("Database connection failed.")
        }

    try:
        cur = connection.cursor()

        select_query = """
        SELECT * FROM "patient_data"
        WHERE patient_id = %s
        AND filename = %s
        AND filetype = %s;
        """
        cur.execute(select_query, (patient_id, file_name, file_type))
        existing_file = cur.fetchone()

        if existing_file:
            # Update the existing record
            update_query = """
                UPDATE "patient_data"
                SET s3_bucket_reference = %s,
                    filepath = %s,
                    time_uploaded = %s
                WHERE patient_id = %s
                AND filename = %s
                AND filetype = %s;
            """
            timestamp = datetime.now(timezone.utc)
            cur.execute(update_query, (
                bucket_name, file_path, timestamp, patient_id, file_name, file_type
            ))
            logger.info(f"Successfully updated file {file_name}.{file_type} in database for patient {patient_id}.")
        else:
            # Insert a new record
            insert_query = """
                INSERT INTO "patient_data" 
                (patient_id, filetype, s3_bucket_reference, filepath, filename, time_uploaded, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """
            timestamp = datetime.now(timezone.utc)
            cur.execute(insert_query, (
                patient_id, file_type, bucket_name, file_path, file_name, timestamp, ""
            ))
            logger.info(f"Successfully inserted file {file_name}.{file_type} for patient {patient_id}.")

        connection.commit()
        cur.close()
    except Exception as e:
        if cur:
            cur.close()
        connection.rollback()
        logger.error(f"Error inserting file {file_name}.{file_type} into database: {e}")
        raise

def update_vectorstore_from_s3(bucket, patient_id):
    embeddings = BedrockEmbeddings(
        model_id=get_parameter(), 
        client=bedrock_runtime,
        region_name=REGION
    )

    secret = get_secret()

    vectorstore_config_dict = {
        'collection_name': f'{patient_id}',
        'dbname': secret["dbname"],
        'user': secret["username"],
        'password': secret["password"],
        'host': RDS_PROXY_ENDPOINT,
        'port': secret["port"]
    }

    try:
        update_vectorstore(
            bucket=bucket,
            group=patient_id,
            vectorstore_config_dict=vectorstore_config_dict,
            embeddings=embeddings
        )
    except Exception as e:
        logger.error(f"Error updating vectorstore for patient {patient_id}: {e}")
        raise

def handler(event, context):
    records = event.get('Records', [])
    if not records:
        return {
            "statusCode": 400,
            "body": json.dumps("No valid S3 event found.")
        }

    for record in records:
        event_name = record['eventName']
        bucket_name = record['s3']['bucket']['name']

        if bucket_name != DATA_INGESTION_BUCKET:
            logger.info(f"Ignoring event from non-target bucket: {bucket_name}")
            continue

        file_key = record['s3']['object']['key']
        parsed = parse_s3_file_path(file_key)
        simulation_group_id = parsed.simulation_group_id
        patient_id = parsed.patient_id
        file_category = parsed.file_category
        file_name = parsed.file_name
        file_type = parsed.file_type

        if not simulation_group_id or not patient_id or not file_name or not file_type:
            return {
                "statusCode": 400,
                "body": json.dumps("Error parsing S3 file path.")
            }

        if event_name.startswith('ObjectCreated:'):
            try:
                insert_file_into_db(
                    patient_id=patient_id,
                    file_name=file_name,
                    file_type=file_type,
                    file_path=file_key,
                    bucket_name=bucket_name
                )
                logger.info(f"File {file_name}.{file_type} inserted successfully.")
            except Exception as e:
                logger.error(f"Error inserting file {file_name}.{file_type} into database: {e}")
                return {
                    "statusCode": 500,
                    "body": json.dumps(f"Error inserting file {file_name}.{file_type}: {e}")
                }
        else:
            logger.info(f"File {file_name}.{file_type} is being deleted. Deleting files from database does not occur here.")
        
        # Update embeddings for patient after the file is successfully inserted into the database. Only if document file
        if file_category == "documents":
            try:
                update_vectorstore_from_s3(bucket_name, patient_id)
                logger.info(f"Vectorstore updated successfully for patient {patient_id}.")
            except Exception as e:
                logger.error(f"Error updating vectorstore for patient {patient_id}: {e}")
                return {
                    "statusCode": 500,
                    "body": json.dumps(f"File inserted, but error updating vectorstore: {e}")
                }
        else:            
            logger.info(f"{file_name}.{file_type} in {file_category} folder is not ingested")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "New file inserted into database.",
                "location": f"s3://{bucket_name}/{file_key}"
            })
        }

    return {
        "statusCode": 400,
        "body": json.dumps("No new file upload or deletion event found.")
    }