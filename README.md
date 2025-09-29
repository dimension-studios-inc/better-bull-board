# Better Bull Board

## What we store
- **Queues**: via polling
- **Schedulers**: via polling
- **Jobs**: via ingestion
- **Jobs Logs**: via ingestion

## How does this work?
There's two main notions in this project:

- **Polling**: This process is used for long living data in redis like Queues and Schedulers.
- **Ingestion**: For huge amount of data, we use a different approach. We use a Redis Streams to ingest the data.

### Why not use ingestion everywhere?
Because we want to keep the use of this tool simple wrapping all your queues with the bbb client can be a pain.
Also there's no way to know if the queue / scheduler still exists or not when you delete it if we use ingestion.

## Data retention

As for clickhouse we have a retention policy of 30 days. For postgres the ingester will setup a timeout that delete the data after 30 days.

We are clearing the data from the following entities:
- Job Runs
- Job Logs

## Deployment

### Kubernetes Deployment

This project is designed to be easily deployable on Kubernetes. All necessary configuration files are provided in the `k8s/` directory.

**Quick Start:**
1. Build and push Docker images to your registry (see [Docker Build Guide](DOCKER_BUILD_GUIDE.md))
2. Update configuration files with your registry URLs and domain
3. Deploy to Kubernetes using the provided manifests

For detailed deployment instructions, see [Kubernetes Deployment Guide](KUBERNETES_DEPLOYMENT.md).

**Architecture:**
- **PostgreSQL**: Database with custom extensions (pgvector, PostGIS, pg_uuidv7)
- **ClickHouse**: Analytics database for storing job metrics and logs
- **Redis**: Queue management and caching
- **App**: Next.js frontend application (horizontally scalable)
- **Ingest**: Background service for data ingestion

### Local Development

For local development, use the Docker Compose setup:

```bash
# Start the local development environment
docker-compose -f docker/compose.local.yaml up -d

# Run the development servers
npm run dev
```
