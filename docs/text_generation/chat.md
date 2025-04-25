# chat.py

## Table of Contents <a name="table-of-contents"></a>
- [Script Overview](#script-overview)
  - [Import Libraries](#import-libraries)
  - [AWS and LLM Integration](#aws-and-llm-integration)
  - [Helper Functions](#helper-functions)
  - [Execution Flow](#execution-flow)
- [Detailed Function Descriptions](#detailed-function-descriptions)
  - [Function: `create_dynamodb_history_table`](#create_dynamodb_history_table)
  - [Function: `get_bedrock_llm`](#get_bedrock_llm)
  - [Function: `get_student_query`](#get_student_query)
  - [Function: `get_initial_student_query`](#get_initial_student_query)
  - [Function: `get_response`](#get_response)
  - [Function: `generate_response`](#generate_response)
  - [Function: `split_into_sentences`](#split_into_sentences)
  - [Function: `get_llm_output`](#get_llm_output)
  - [Function: `update_session_name`](#update_session_name)

## Script Overview <a name="script-overview"></a>
This script integrates AWS services like DynamoDB and Bedrock LLM with LangChain to create an educational chatbot that can engage with students, ask questions, provide answers, and track student progress toward diagnosing a patient. It also includes history-aware functionality, which uses chat history to provide relevant context during conversations.

### Import Libraries <a name="import-libraries"></a>
- **boto3**: AWS SDK to interact with services like DynamoDB and manage resources.
- **re**: The re library in Python is used for working with regular expressions, which are sequences of characters that form search patterns.
- **ChatBedrock**: Interface for interacting with AWS Bedrock LLM.
- **ChatPromptTemplate, MessagesPlaceholder**: Templates for setting up prompts in LangChain with chat history awareness.
- **create_stuff_documents_chain, create_retrieval_chain**: LangChain utilities to combine document chains and retrieval chains for context-aware question-answering.
- **RunnableWithMessageHistory**: Allows the inclusion of chat history in the reasoning chain.
- **DynamoDBChatMessageHistory**: Stores chat history in DynamoDB.

### AWS and LLM Integration <a name="aws-and-llm-integration"></a>
- **DynamoDB**: Used to store and retrieve session history for conversations between the student and the chatbot.
- **ChatBedrock**: Used to interact with AWS Bedrock LLM for generating responses and engaging with the student.

### Helper Functions <a name="helper-functions"></a>
- **create_dynamodb_history_table**: Creates a DynamoDB table to store chat session history if it doesn't already exist.
- **get_bedrock_llm**: Retrieves an instance of the Bedrock LLM based on a provided model ID.
- **get_student_query**: Formats a student's query into a structured template suitable for processing.
- **get_initial_student_query**: Generates an initial prompt for a student to greet the chatbot and request a question on a specific patient.
- **get_response**: Manages the interaction between the student query, the Bedrock LLM, and the history-aware retriever to generate responses.
- **get_llm_output**: Processes the output from the LLM and checks if the student has properly diagnosed the patient or not.

### Execution Flow <a name="execution-flow"></a>
1. **DynamoDB Table Creation**: The `create_dynamodb_history_table` function ensures that a DynamoDB table is available to store session history.
2. **Query Processing**: The `get_student_query` and `get_initial_student_query` functions format student queries for processing.
3. **Response Generation**: The `get_response` function uses the Bedrock LLM and chat history to generate responses to student queries and evaluates the student's progress toward diagnosing a patient.
4. **Proper Diagnosis Evaluation**: The `get_llm_output` function checks if the LLM response indicates that the student has properly diagnosed the student.
5. **RAG Chain Invocation**: The `generate_response` function invokes the RunnableWithMessageHistory chain to generate context-aware responses. This ensures the session_id is maintained for seamless retrieval of chat history.
6. **Session Naming**: The `update_session_name` function assigns a descriptive name to a session if it meets specific criteria (e.g., exactly one exchange of messages).
7. **LLM Output Processing**: The `get_llm_output` function determines whether the proper diagnosis has been achieved, updating the conversation flow accordingly.

## Detailed Function Descriptions <a name="detailed-function-descriptions"></a>

### Function: `create_dynamodb_history_table` <a name="create_dynamodb_history_table"></a>
```python
def create_dynamodb_history_table(table_name: str) -> None:
    # Get the service resource and client.
    dynamodb_resource = boto3.resource("dynamodb")
    dynamodb_client = boto3.client("dynamodb")
    
    # Retrieve the list of tables that currently exist.
    existing_tables = []
    exclusive_start_table_name = None
    
    while True:
        if exclusive_start_table_name:
            response = dynamodb_client.list_tables(ExclusiveStartTableName=exclusive_start_table_name)
        else:
            response = dynamodb_client.list_tables()
        
        existing_tables.extend(response.get('TableNames', []))
        
        if 'LastEvaluatedTableName' in response:
            exclusive_start_table_name = response['LastEvaluatedTableName']
        else:
            break
    
    if table_name not in existing_tables:  # Create a new table if it doesn't exist.
        # Create the DynamoDB table.
        table = dynamodb_resource.create_table(
            TableName=table_name,
            KeySchema=[{"AttributeName": "SessionId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "SessionId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        
        # Wait until the table exists.
        table.meta.client.get_waiter("table_exists").wait(TableName=table_name)
```
#### Purpose
Creates a DynamoDB table to store the chat session history if the table doesn't already exist.

#### Process Flow
1. **Check Existing Tables**: Retrieves the list of existing DynamoDB tables.
2. **Table Creation**: If the specified table does not exist, creates it with a `SessionId` key schema and sets up pay-per-request billing mode.
3. **Wait for Table**: Waits for the table creation to complete before returning.

#### Inputs and Outputs
- **Inputs**:
  - `table_name`: The name of the DynamoDB table to create.
  
- **Outputs**:
  - No return value. The function ensures that the specified table exists.

---

### Function: `get_bedrock_llm` <a name="get_bedrock_llm"></a>
```python
def get_bedrock_llm(
    bedrock_llm_id: str,
    temperature: float = 0
) -> ChatBedrock:
    return ChatBedrock(
        model_id=bedrock_llm_id,
        model_kwargs=dict(temperature=temperature),
    )
```
#### Purpose
Retrieves a Bedrock LLM instance based on the provided model ID, with optional control over response randomness through the `temperature` parameter.

#### Process Flow
1. **Create LLM Instance**: Initializes a `ChatBedrock` instance with the specified model ID and temperature setting.
2. **Return LLM**: Returns the initialized LLM instance.

#### Inputs and Outputs
- **Inputs**:
  - `bedrock_llm_id`: The model ID for the Bedrock LLM.
  - `temperature`: Controls the randomness of the LLM's responses (default is 0 for deterministic outputs).
  
- **Outputs**:
  - Returns a `ChatBedrock` instance.

---

### Function: `get_student_query` <a name="get_student_query"></a>
```python
def get_student_query(raw_query: str) -> str:
    student_query = f"""
    user
    {raw_query}
    
    """
    return student_query
```
#### Purpose
Formats a raw student query into a structured template suitable for further processing by the LLM.

#### Process Flow
1. **Format Query**: Wraps the student's query with the `user` label to structure it for the LLM.
2. **Return Formatted Query**: Returns the structured query.

#### Inputs and Outputs
- **Inputs**:
  - `raw_query`: The raw query input from the student.
  
- **Outputs**:
  - Returns the formatted query string.

---

### Function: `get_initial_student_query` <a name="get_initial_student_query"></a>
```python
def get_initial_student_query(patient_name: str) -> str:
    student_query = f"""
    user
    Greet me and then ask me a question related to the patient: {patient_name}. 
    """
    return student_query
```
#### Purpose
Generates an initial prompt asking the student to greet the system and pose a question related to a specific patient.

#### Process Flow
1. **Generate Initial Query**: Constructs a query asking the student to greet the system and inquire about a specific patient.
2. **Return Query**: Returns the generated query.

#### Inputs and Outputs
- **Inputs**:
  - `patient_name`: The name of a patient for which the initial question should be generated.
  
- **Outputs**:
  - Returns the formatted initial query string.

---

### Function: `get_response` <a name="get_response"></a>
```python
def get_response(
    query: str,
    patient_name: str,
    llm: ChatBedrock,
    history_aware_retriever,
    table_name: str,
    session_id: str,
    system_prompt: str,
    patient_prompt: str,
    llm_completion: bool
) -> dict:
    
    completion_string = """
                Once I, the pharmacy student, have give you a diagnosis, politely leave the conversation and wish me goodbye.
                Regardless if I have given you the proper diagnosis or not for the patient you are pretending to be, stop talking to me.
                """
    if llm_completion:
        completion_string = """
                Continue this process until you determine that me, the pharmacy student, has properly diagnosed the patient you are pretending to be.
                Once the proper diagnosis is provided, include PHRM GOAL ACHIEVED in your response and do not continue the conversation.
                """

    # Create a system prompt for the question answering
    system_prompt = (
        f"""
        <|begin_of_text|>
        <|start_header_id|>patient<|end_header_id|>
        You are a patient, I am a pharmacy student. Your name is {patient_name} and you are going to pretend to be a patient talking to me, a pharmacy student.
        You are not the pharmacy student. You are the patient. Look at the document(s) provided to you and act as a patient with those symptoms.
        Please pay close attention to this: {system_prompt}
        Here are some additional details about your personality, symptoms, or overall condition: {patient_prompt}
        {completion_string}
        Use the following document(s) to provide
        hints as a patient to me, the pharmacy student. Use three sentences maximum when describing your symptoms to provide clues to me, the pharmacy student.
        End each clue with a question that pushes me to the correct diagnosis. I might ask you questions or provide my thoughts as statements.
        Again, YOU ARE SUPPOSED TO ACT AS THE PATIENT. I AM THE PHARMACY STUDENT. 
        <|eot_id|>
        <|start_header_id|>documents<|end_header_id|>
        {{context}}
        <|eot_id|>
        """
    )
    
    qa_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )
    question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)
    rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)

    conversational_rag_chain = RunnableWithMessageHistory(
        rag_chain,
        lambda session_id: DynamoDBChatMessageHistory(
            table_name=table_name, 
            session_id=session_id
        ),
        input_messages_key="input",
        history_messages_key="chat_history",
        output_messages_key="answer",
    )
    
    # Generate the response until it's not empty
    response = ""
    while not response:
        response = generate_response(
            conversational_rag_chain,
            query,
            session_id
        )
    
    return get_llm_output(response, llm_completion)
```
#### Purpose
Generates a response to the student's query using the Bedrock LLM, context from a history-aware retriever, and stored chat history. This function ensures that responses are contextually aware, helping students simulate diagnosing a mock patient.

#### Process Flow
1. **Define Conversation Flow**: Sets up a completion_string to instruct the LLM on when to end the conversation:
  - If `llm_completion` is `True`: The LLM continues the process until the proper diagnosis is made.
  - If `llm_completion` is `False`: The LLM ends the conversation after providing any diagnosis.
2. **Create a System Prompt**: Constructs a detailed system prompt specifying the roles of the student (pharmacy student) and the LLM (acting as the patient). This includes:
  - Details about the patient’s symptoms and personality.
  - Instructions to use retrieved documents for context.
  - Clear boundaries for the LLM's responses (e.g., number of sentences, ending responses with questions).
3. **Setup Question Answering Chain**: Uses LangChain utilities to integrate the Bedrock LLM and retriever into a chain:
  - `create_stuff_documents_chain`: Combines the LLM with prompts for question answering.
  - `create_retrieval_chain`: Incorporates document retrieval into the reasoning process.
4. **Generate Response**: Invokes the RAG (Retrieval-Augmented Generation) chain with the student's query and session context. Repeats the generation process until a valid (non-empty) response is obtained.
5. **Process and Return Response**: The generated response is passed to `get_llm_output` to:
  - Check if the proper diagnosis was achieved.
  - Return the final structured response.

#### Inputs and Outputs
- **Inputs**:
  - `query`: The student's query string.
  - `patient_name`: The patient name the student is diagnosing.
  - `llm`: The Bedrock LLM instance.
  - `history_aware_retriever`: The retriever providing relevant documents for the query.
  - `table_name`: DynamoDB table name used to store the chat history.
  - `session_id`: Unique identifier for the chat session.
  - `system_prompt `: Initial system prompt with conversation rules and guidance.
  - `patient_prompt `: Additional context about the patient’s symptoms and personality.
  - `llm_completion `: Controls whether the LLM stops after any diagnosis or waits for the correct diagnosis.
  
- **Outputs**:
  - Returns a dictionary with:
    - `llm_output`: The response generated by the LLM.
    - `llm_verdict`: `True` if the proper diagnosis was achieved, `False` otherwise.

---

### Function: `generate_response` <a name="generate_response"></a>
```python
def generate_response(conversational_rag_chain: object, query: str, session_id: str) -> str:

    return conversational_rag_chain.invoke(
        {
            "input": query
        },
        config={
            "configurable": {"session_id": session_id}
        },  # constructs a key "session_id" in `store`.
    )["answer"]
```
#### Purpose
Invokes the RAG chain to generate a response for the given query, considering the session history.

#### Process Flow
1. Passes the query to the conversational_rag_chain instance.
2. Includes the session_id in the configuration to ensure the response is generated with context from the relevant session.
3. Extracts and returns the answer from the RAG chain's output.

#### Inputs and Outputs
- **Inputs**:
  - `conversational_rag_chain`: The chain object processing the query.
  - `query`: The student's query.
  - `session_id`: Unique identifier for the current session.
  
- **Outputs**:
  - Returns the generated response as a string.

---

### Function: `split_into_sentences` <a name="split_into_sentences"></a>
```python
def split_into_sentences(paragraph: str) -> list[str]:
    # Regular expression pattern
    sentence_endings = r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s'
    sentences = re.split(sentence_endings, paragraph)
    return sentences
```
#### Purpose
Splits a given paragraph into individual sentences using a regular expression to detect sentence boundaries while avoiding incorrect splits at abbreviations and edge cases.

#### Process Flow
1. **Regular Expression Pattern**: The pattern `sentence_endings` is designed to identify sentence boundaries marked by periods (`.`), question marks (`?`), or exclamation marks (`!`) followed by a whitespace character. Negative lookbehind assertions are used to prevent splitting on common abbreviations (e.g., "Dr.", "U.S."). Here is a breakdown of the regular expression pattern:
    - `(?<!\w\.\w.)`: Negative lookbehind to avoid splitting within abbreviations like "e.g." or "U.S."
    - `(?<![A-Z][a-z]\.)`: Negative lookbehind to avoid splitting after titles like "Dr." or "Mrs."
    - `(?<=\.|\?|\!)`: Positive lookbehind to ensure the split occurs after a period (.), question mark (?), or exclamation mark (!).
    - `\s`: Matches a whitespace character where the actual split will occur.
3. **Split a paragraph into sentences**: The `re.split()` function uses the `sentence_endings` pattern to split the input paragraph into a list of sentences. This results in a list where each element is a sentence extracted from the paragraph. 
4. **Return sentences list**: The function returns the list of sentences for further processing.

#### Inputs and Outputs
- **Inputs**:
  - `paragraph` (*str*): The input text paragraph to be split into sentences.
  
- **Outputs**:
  - Returns a `list[str]`: A list where each element is a sentence from the input paragraph.

---

### Function: `get_llm_output` <a name="get_llm_output"></a>
```python
def get_llm_output(response: str, llm_completion: bool) -> dict:

    completion_sentence = " Congratulations! You have provided the proper diagnosis for me, the patient I am pretending to be! Please try other mock patients to continue your diagnosis skills! :)"

    if not llm_completion:
        return dict(
            llm_output=response,
            llm_verdict=False
        )
    
    elif "PHRM GOAL ACHIEVED" not in response:
        return dict(
            llm_output=response,
            llm_verdict=False
        )
    
    elif "PHRM GOAL ACHIEVED" in response:
        sentences = split_into_sentences(response)
        
        for i in range(len(sentences)):
            
            if "PHRM GOAL ACHIEVED" in sentences[i]:
                llm_response=' '.join(sentences[0:i-1])
                
                if sentences[i-1][-1] == '?':
                    return dict(
                        llm_output=llm_response,
                        llm_verdict=False
                    )
                else:
                    return dict(
                        llm_output=llm_response + completion_sentence,
                        llm_verdict=True
                    )
```
#### Purpose
Processes the response from the LLM to determine whether the proper diagnosis for the patient has been achieved. Extracts relevant output and assigns a verdict indicating success or failure.

#### Process Flow
1. **Check for "PHRM GOAL ACHIEVED" Absence**: If **"PHRM GOAL ACHIEVED"** is **not** in the response, return the original response with `llm_verdict` set to `False`.
2. **Check for "PHRM GOAL ACHIEVED" Presence**: If **"PHRM GOAL ACHIEVED"** is in the response:
  - Splits the response into sentences using `split_into_sentences(response)`.
  - Iterates through the sentences to find the one containing **"PHRM GOAL ACHIEVED"**.
  - Extracts all sentences before **"PHRM GOAL ACHIEVED"** and joins them into `llm_response`.
  - Checks the punctuation of the sentence immediately before **"PHRM GOAL ACHIEVED"**:
    - If the preceding sentence ends with a question mark (`?`):
      - Sets `llm_verdict` to `False` (indicating the proper diagnosis was not found).
    - Else:
      - Sets `llm_verdict` to `True` (indicating the proper diagnosis was found).
  - Returns `llm_response` and `llm_verdict`.

#### Inputs and Outputs
- **Inputs**:
  - `response`: The response generated by the LLM.
  - `llm_completion`: A flag controlling whether the LLM response should be evaluated for achieving a proper diagnosis.
  
- **Outputs**:
  - Returns a dictionary with the LLM's output and a boolean indicating whether the student has properly diagnosed the mock patient.

---
### Function: `update_session_name` <a name="update_session_name"></a>
```python
def update_session_name(table_name: str, session_id: str, bedrock_llm_id: str) -> str:
    
    dynamodb_client = boto3.client("dynamodb")
    
    # Retrieve the conversation history from the DynamoDB table
    try:
        response = dynamodb_client.get_item(
            TableName=table_name,
            Key={
                'SessionId': {
                    'S': session_id
                }
            }
        )
    except Exception as e:
        print(f"Error fetching conversation history from DynamoDB: {e}")
        return None

    history = response.get('Item', {}).get('History', {}).get('L', [])



    human_messages = []
    ai_messages = []
    
    # Find the first human and ai messages in the history
    # Check if length of human messages is 2 since the prompt counts as 1
    # Check if length of AI messages is 2 since after first response by student, another response is generated
    for item in history:
        message_type = item.get('M', {}).get('data', {}).get('M', {}).get('type', {}).get('S')
        
        if message_type == 'human':
            human_messages.append(item)
            if len(human_messages) > 2:
                print("More than one student message found; not the first exchange.")
                return None
        
        elif message_type == 'ai':
            ai_messages.append(item)
            if len(ai_messages) > 2:
                print("More than one AI message found; not the first exchange.")
                return None

    if len(human_messages) != 2 or len(ai_messages) != 2:
        print("Not a complete first exchange between the LLM and student.")
        return None
    
    student_message = human_messages[0].get('M', {}).get('data', {}).get('M', {}).get('content', {}).get('S', "")
    llm_message = ai_messages[0].get('M', {}).get('data', {}).get('M', {}).get('content', {}).get('S', "")
    
    llm = BedrockLLM(
                        model_id = bedrock_llm_id
                    )
    
    system_prompt = """
        You are given the first message from an AI and the first message from a student in a conversation. 
        Based on these two messages, come up with a name that describes the conversation. 
        The name should be less than 30 characters. ONLY OUTPUT THE NAME YOU GENERATED. NO OTHER TEXT.
    """
    
    prompt = f"""
        <|begin_of_text|>
        <|start_header_id|>system<|end_header_id|>
        {system_prompt}
        <|eot_id|>
        <|start_header_id|>AI Message<|end_header_id|>
        {llm_message}
        <|eot_id|>
        <|start_header_id|>Student Message<|end_header_id|>
        {student_message}
        <|eot_id|>
        <|start_header_id|>assistant<|end_header_id|>
    """
    
    session_name = llm.invoke(prompt)
    return session_name
```
#### Purpose
Generates a descriptive session name based on the first messages exchanged by the student and the AI.

#### Process Flow
1. Fetches the chat history from DynamoDB using the session ID.
2. Ensures exactly one human and one AI message are present in the history.
3. Uses the Bedrock LLM to generate a name based on the initial messages.
4. Returns the session name if conditions are met; otherwise, returns None.

#### Inputs and Outputs
- **Inputs**:
  - `table_name`: The DynamoDB table name.
  - `session_id`: The session ID for the conversation.
  - `bedrock_llm_id`: The Bedrock LLM model ID used for naming.
  
- **Outputs**:
  - Returns the session name or None if conditions are unmet.
  
[🔼 Back to top](#table-of-contents)
