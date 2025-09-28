#!/bin/bash

# Configuration
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
# Replace with your alias
export MY_ALIAS=n5q7l0s4
export ECR_REGISTRY=public.ecr.aws/${MY_ALIAS}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Better Bull Board - Docker Build and Push Script${NC}"
echo "================================================"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Authenticate with ECR
echo -e "${YELLOW}Authenticating with ECR...${NC}"
aws ecr-public get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin public.ecr.aws

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to authenticate with ECR${NC}"
    exit 1
fi

echo -e "${GREEN}Successfully authenticated with ECR${NC}"

# Build and push PostgreSQL
echo -e "${YELLOW}Building and pushing PostgreSQL image...${NC}"
cd docker/db
docker build -t better-bull-board-postgres .
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build PostgreSQL image${NC}"
    exit 1
fi

docker tag better-bull-board-postgres:latest ${ECR_REGISTRY}/better-bull-board-postgres:latest
docker push ${ECR_REGISTRY}/better-bull-board-postgres:latest
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to push PostgreSQL image${NC}"
    exit 1
fi
cd ../..
echo -e "${GREEN}PostgreSQL image built and pushed successfully${NC}"

# Build and push ClickHouse
echo -e "${YELLOW}Building and pushing ClickHouse image...${NC}"
cd docker/clickhouse
docker build -t better-bull-board-clickhouse .
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build ClickHouse image${NC}"
    exit 1
fi

docker tag better-bull-board-clickhouse:latest ${ECR_REGISTRY}/better-bull-board-clickhouse:latest
docker push ${ECR_REGISTRY}/better-bull-board-clickhouse:latest
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to push ClickHouse image${NC}"
    exit 1
fi
cd ../..
echo -e "${GREEN}ClickHouse image built and pushed successfully${NC}"

# Build and push App
echo -e "${YELLOW}Building and pushing App image...${NC}"
docker build -f apps/app/Dockerfile -t better-bull-board-app .
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build App image${NC}"
    exit 1
fi

docker tag better-bull-board-app:latest ${ECR_REGISTRY}/better-bull-board-app:latest
docker push ${ECR_REGISTRY}/better-bull-board-app:latest
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to push App image${NC}"
    exit 1
fi
echo -e "${GREEN}App image built and pushed successfully${NC}"

# Build and push Ingest
echo -e "${YELLOW}Building and pushing Ingest image...${NC}"
docker build -f apps/ingest/Dockerfile -t better-bull-board-ingest .
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build Ingest image${NC}"
    exit 1
fi

docker tag better-bull-board-ingest:latest ${ECR_REGISTRY}/better-bull-board-ingest:latest
docker push ${ECR_REGISTRY}/better-bull-board-ingest:latest
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to push Ingest image${NC}"
    exit 1
fi
echo -e "${GREEN}Ingest image built and pushed successfully${NC}"

echo ""
echo -e "${GREEN}All images built and pushed successfully!${NC}"
echo ""
echo -e "${YELLOW}Update your Kubernetes deployment files with these image URIs:${NC}"
echo "  PostgreSQL: ${ECR_REGISTRY}/better-bull-board-postgres:latest"
echo "  ClickHouse: ${ECR_REGISTRY}/better-bull-board-clickhouse:latest"
echo "  App: ${ECR_REGISTRY}/better-bull-board-app:latest"
echo "  Ingest: ${ECR_REGISTRY}/better-bull-board-ingest:latest"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update the image URLs in your k8s deployment files"
echo "2. Create EBS volumes for persistent storage"
echo "3. Update domain and secrets in the configuration files"
echo "4. Follow Quick Start in KUBERNETES_DEPLOYMENT.md to deploy the application"