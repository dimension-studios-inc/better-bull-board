# Docker Build and Push Guide for AWS

This guide will help you build and push the Docker images for the Better Bull Board application to AWS ECR (Elastic Container Registry).

## Prerequisites

1. **AWS CLI** installed and configured
2. **Docker** installed and running
3. **AWS ECR repositories** created
4. **Proper IAM permissions** for ECR operations

## Setup AWS ECR Repositories

### 1. Create ECR Repositories

Create repositories for each component:

```bash
# Create repositories
aws ecr create-repository --repository-name better-bull-board-postgres --region us-west-2
aws ecr create-repository --repository-name better-bull-board-clickhouse --region us-west-2
aws ecr create-repository --repository-name better-bull-board-app --region us-west-2
aws ecr create-repository --repository-name better-bull-board-ingest --region us-west-2
```

### 2. Get Repository URIs

Save the repository URIs from the output, they will look like:
```
123456789.dkr.ecr.us-west-2.amazonaws.com/better-bull-board-postgres
123456789.dkr.ecr.us-west-2.amazonaws.com/better-bull-board-clickhouse
123456789.dkr.ecr.us-west-2.amazonaws.com/better-bull-board-app
123456789.dkr.ecr.us-west-2.amazonaws.com/better-bull-board-ingest
```

## Building and Pushing Images

### 1. Authenticate Docker with ECR

```bash
# Get login token and authenticate Docker
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-west-2.amazonaws.com
```

### 2. Set Environment Variables

Set your AWS account ID and region:

```bash
export AWS_ACCOUNT_ID=123456789
export AWS_REGION=us-west-2
export ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

### 3. Build and Push PostgreSQL Image

```bash
# Build PostgreSQL image with custom extensions
cd docker/db
docker build -t better-bull-board-postgres .
docker tag better-bull-board-postgres:latest ${ECR_REGISTRY}/better-bull-board-postgres:latest
docker push ${ECR_REGISTRY}/better-bull-board-postgres:latest

# Go back to project root
cd ../..
```

### 4. Build and Push ClickHouse Image

```bash
# Build ClickHouse image
cd docker/clickhouse
docker build -t better-bull-board-clickhouse .
docker tag better-bull-board-clickhouse:latest ${ECR_REGISTRY}/better-bull-board-clickhouse:latest
docker push ${ECR_REGISTRY}/better-bull-board-clickhouse:latest

# Go back to project root
cd ../..
```

### 5. Build and Push App Image

```bash
# Build the Next.js app image
docker build -f apps/app/Dockerfile -t better-bull-board-app .
docker tag better-bull-board-app:latest ${ECR_REGISTRY}/better-bull-board-app:latest
docker push ${ECR_REGISTRY}/better-bull-board-app:latest
```

### 6. Build and Push Ingest Image

```bash
# Build the ingest service image
docker build -f apps/ingest/Dockerfile -t better-bull-board-ingest .
docker tag better-bull-board-ingest:latest ${ECR_REGISTRY}/better-bull-board-ingest:latest
docker push ${ECR_REGISTRY}/better-bull-board-ingest:latest
```

## Complete Build Script

Here's a complete script to build and push all images:

```bash
#!/bin/bash

# Configuration
export AWS_ACCOUNT_ID=123456789  # Replace with your AWS account ID
export AWS_REGION=us-west-2      # Replace with your preferred region
export ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Authenticate with ECR
echo "Authenticating with ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

if [ $? -ne 0 ]; then
    echo "Failed to authenticate with ECR"
    exit 1
fi

# Build and push PostgreSQL
echo "Building and pushing PostgreSQL image..."
cd docker/db
docker build -t better-bull-board-postgres .
docker tag better-bull-board-postgres:latest ${ECR_REGISTRY}/better-bull-board-postgres:latest
docker push ${ECR_REGISTRY}/better-bull-board-postgres:latest
cd ../..

# Build and push ClickHouse
echo "Building and pushing ClickHouse image..."
cd docker/clickhouse
docker build -t better-bull-board-clickhouse .
docker tag better-bull-board-clickhouse:latest ${ECR_REGISTRY}/better-bull-board-clickhouse:latest
docker push ${ECR_REGISTRY}/better-bull-board-clickhouse:latest
cd ../..

# Build and push App
echo "Building and pushing App image..."
docker build -f apps/app/Dockerfile -t better-bull-board-app .
docker tag better-bull-board-app:latest ${ECR_REGISTRY}/better-bull-board-app:latest
docker push ${ECR_REGISTRY}/better-bull-board-app:latest

# Build and push Ingest
echo "Building and pushing Ingest image..."
docker build -f apps/ingest/Dockerfile -t better-bull-board-ingest .
docker tag better-bull-board-ingest:latest ${ECR_REGISTRY}/better-bull-board-ingest:latest
docker push ${ECR_REGISTRY}/better-bull-board-ingest:latest

echo "All images built and pushed successfully!"
echo ""
echo "Update your Kubernetes deployment files with these image URIs:"
echo "  PostgreSQL: ${ECR_REGISTRY}/better-bull-board-postgres:latest"
echo "  ClickHouse: ${ECR_REGISTRY}/better-bull-board-clickhouse:latest"
echo "  App: ${ECR_REGISTRY}/better-bull-board-app:latest"
echo "  Ingest: ${ECR_REGISTRY}/better-bull-board-ingest:latest"
```

Save this script as `build-and-push.sh` and make it executable:

```bash
chmod +x build-and-push.sh
./build-and-push.sh
```

## Image Versioning

For production deployments, it's recommended to use specific version tags instead of `latest`:

```bash
# Example with version tags
export VERSION=v1.0.0

docker tag better-bull-board-app:latest ${ECR_REGISTRY}/better-bull-board-app:${VERSION}
docker push ${ECR_REGISTRY}/better-bull-board-app:${VERSION}
```

## Updating Kubernetes Deployments

After pushing your images, update the Kubernetes deployment files:

1. **Edit the deployment files** in the `k8s/` directory
2. **Replace `your-registry`** with your actual ECR registry URL
3. **Update image tags** if using specific versions

Example:
```yaml
# In k8s/17-app-deployment.yaml
containers:
- name: app
  image: 123456789.dkr.ecr.us-west-2.amazonaws.com/better-bull-board-app:latest
```

## CI/CD Integration

For automated builds, you can integrate this process into your CI/CD pipeline:

### GitHub Actions Example

```yaml
name: Build and Push to ECR

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build and push images
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        # Build and push all images with commit SHA as tag
        docker build -f apps/app/Dockerfile -t $ECR_REGISTRY/better-bull-board-app:$IMAGE_TAG .
        docker push $ECR_REGISTRY/better-bull-board-app:$IMAGE_TAG
        
        docker build -f apps/ingest/Dockerfile -t $ECR_REGISTRY/better-bull-board-ingest:$IMAGE_TAG .
        docker push $ECR_REGISTRY/better-bull-board-ingest:$IMAGE_TAG
```

## Troubleshooting

### Common Issues

1. **Authentication errors**: Ensure your AWS credentials have ECR permissions
2. **Repository not found**: Make sure ECR repositories are created
3. **Build failures**: Check Dockerfile syntax and dependencies
4. **Push failures**: Verify network connectivity and image size limits

### Required IAM Permissions

Your AWS user/role needs these ECR permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:BatchImportLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:InitiateLayerUpload",
                "ecr:PutImage",
                "ecr:UploadLayerPart"
            ],
            "Resource": "*"
        }
    ]
}
```

## Clean Up

To clean up local images after pushing:

```bash
# Remove local images
docker rmi better-bull-board-postgres better-bull-board-clickhouse better-bull-board-app better-bull-board-ingest

# Remove unused images and cache
docker system prune -f
```