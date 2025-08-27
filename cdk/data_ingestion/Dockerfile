FROM public.ecr.aws/lambda/python:3.11

# Upgrade pip, setuptools, and wheel to ensure prebuilt wheels are used
RUN pip install --upgrade pip setuptools wheel

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install Python packages from prebuilt wheels
# Make sure requirements.txt pins PyMuPDF to a wheel-compatible version, e.g., pymupdf==1.24.10
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code
COPY src/ ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "main.handler" ]