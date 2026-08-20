# Docker images

App and ingest images for this repo are built and pushed by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) on every push to `main`. There is no local build script for those.

Use this guide to create ECR Public repositories, rebuild the Postgres image, or push app/ingest to your own registry.

## Prerequisites

- AWS CLI configured
- Docker running
- IAM permissions for ECR Public

## Repositories

```bash
aws ecr-public create-repository --repository-name better-bull-board-postgres --region us-east-1
aws ecr-public create-repository --repository-name better-bull-board-app --region us-east-1
aws ecr-public create-repository --repository-name better-bull-board-ingest --region us-east-1
```

URIs look like `public.ecr.aws/<alias>/better-bull-board-app` (alias is under **ECR Public → Settings**).

```bash
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
export ECR_PUBLIC_REGISTRY=public.ecr.aws/<alias>
```

## Postgres (manual)

Not rebuilt by CI. Rebuild only when `.docker/db` changes.

```bash
docker build -f .docker/db/Dockerfile -t better-bull-board-postgres .docker/db
docker tag better-bull-board-postgres:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-postgres:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-postgres:latest
```

## App and ingest (self-hosting)

```bash
docker build -f apps/app/Dockerfile -t better-bull-board-app .
docker tag better-bull-board-app:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-app:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-app:latest

docker build -f apps/ingest/Dockerfile -t better-bull-board-ingest .
docker tag better-bull-board-ingest:latest ${ECR_PUBLIC_REGISTRY}/better-bull-board-ingest:latest
docker push ${ECR_PUBLIC_REGISTRY}/better-bull-board-ingest:latest
```
