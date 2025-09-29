# Docker Build and Push Guide for AWS Public ECR

This guide will help you build and push your own Docker images for the Better Bull Board application to **AWS Public ECR (Elastic Container Registry Public)** so they can be accessed without authentication.

## Prerequisites

1. **AWS CLI** installed and configured
2. **Docker** installed and running
3. **AWS ECR Public repositories** created
4. **Proper IAM permissions** for ECR Public operations

## Setup AWS Public ECR Repositories

### 1. Create Public ECR Repositories

Create repositories for each component:

```bash
# Create public repositories
aws ecr-public create-repository --repository-name better-bull-board-postgres --region us-east-1
aws ecr-public create-repository --repository-name better-bull-board-clickhouse --region us-east-1
aws ecr-public create-repository --repository-name better-bull-board-app --region us-east-1
aws ecr-public create-repository --repository-name better-bull-board-ingest --region us-east-1
```

### 2. Get Public Repository URIs

Public ECR URIs look like this:

```
public.ecr.aws/abcd1234/better-bull-board-postgres
public.ecr.aws/abcd1234/better-bull-board-clickhouse
public.ecr.aws/abcd1234/better-bull-board-app
public.ecr.aws/abcd1234/better-bull-board-ingest
```

*(where `abcd1234` is your public registry alias – check AWS Console under **ECR Public → Settings** to set or copy it)*

## Building and Pushing Images

### 1. Authenticate Docker with Public ECR

```bash
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

### 2. Set Environment Variables

```bash
export AWS_REGION=us-east-1
export ECR_PUBLIC_REGISTRY=public.ecr.aws/abcd1234   # Replace with your alias
```

### 3. Build and Push PostgreSQL Image

```bash
cd docker/db
docker build -t better-bull-board-postgres .
docker tag better-bull-board-postgres:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-postgres:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-postgres:latest
cd ../..
```

### 4. Build and Push ClickHouse Image

```bash
cd docker/clickhouse
docker build -t better-bull-board-clickhouse .
docker tag better-bull-board-clickhouse:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-clickhouse:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-clickhouse:latest
cd ../..
```

### 5. Build and Push App Image

```bash
docker build -f apps/app/Dockerfile -t better-bull-board-app .
docker tag better-bull-board-app:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-app:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-app:latest
```

### 6. Build and Push Ingest Image

```bash
docker build -f apps/ingest/Dockerfile -t better-bull-board-ingest .
docker tag better-bull-board-ingest:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-ingest:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-ingest:latest
```

## Complete Build Script

The script is located in the root of the project and is called `build-and-push.sh`.