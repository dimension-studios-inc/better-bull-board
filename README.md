# Better Bull Board

> **⚠️ Early Stage Project**: This project is in early development stage and is designed for internal use. Documentation and features may be incomplete or subject to significant changes. Use at your own discretion.

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
1. Build and push Docker images to your registry or use the existing images (see [Docker Build Guide](DOCKER_BUILD_GUIDE.md))
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

## Publishing

### Publishing the Client Package

To publish the `@better-bull-board/client` package to npm for others to use:

1. Navigate to the client package directory:
   ```bash
   cd packages/client
   ```

2. Build the package:
   ```bash
   npm run build
   ```

3. Publish to npm:
   ```bash
   npm publish
   ```

**Note**: Make sure you're logged in to npm (`npm login`) and have the appropriate permissions to publish under the `@better-bull-board` scope. You may also want to update the version in `package.json` before publishing.

## DevOps Self-Hosting Guide

This section is for DevOps teams looking to self-host Better Bull Board in their infrastructure.

### Architecture Requirements

Better Bull Board requires the following infrastructure components:

- **PostgreSQL**: Primary database with extensions (pgvector, PostGIS, pg_uuidv7)
- **ClickHouse**: Analytics database for job metrics and logs  
- **Redis**: External Redis/Dragonfly instance for queue management
- **Kubernetes Cluster**: For orchestration (EKS recommended)
- **Ingress Controller**: nginx-ingress recommended
- **Container Registry**: For hosting Docker images

### Self-Hosting Options

#### Option 1: Kubernetes Deployment (Recommended)

For production deployments, use our Kubernetes manifests:

1. **Build and Push Images**: Follow the [Docker Build Guide](DOCKER_BUILD_GUIDE.md) to build and push images to your container registry
2. **Configure Environment**: Set up your environment variables and secrets
3. **Deploy**: Use the provided K8s manifests in the `k8s/` directory

```bash
# Quick deployment
set -a && source k8s/.env && set +a
envsubst < k8s/02-secrets-configmap.yaml.template > k8s/02-secrets-configmap.yaml
kubectl apply -f k8s/
```

See the [Kubernetes Deployment Guide](KUBERNETES_DEPLOYMENT.md) for detailed instructions.

#### Option 2: Docker Compose (Development)

For local development or testing:

```bash
# Start services
docker-compose -f docker/compose.local.yaml up -d

# Run development servers  
npm run dev
```

### Key Configuration

#### Environment Variables

Essential environment variables to configure:

- **Database**: PostgreSQL connection settings
- **ClickHouse**: Analytics database configuration  
- **Redis**: Queue management connection
- **Security**: Authentication and session management
- **Domains**: Frontend and API endpoints

#### External Dependencies

- **Redis/Dragonfly**: Must be externally managed (not included in our manifests)
- **SSL/TLS**: Configure cert-manager or load balancer SSL termination
- **Monitoring**: Set up logging and metrics collection for the services

#### Scaling Considerations

- **App Service**: Horizontally scalable (multiple replicas supported)
- **Ingest Service**: NOT scalable (single instance only)
- **Database**: Use managed services (AWS RDS, etc.) for production
- **ClickHouse**: Consider clustering for high-volume deployments

### Security Notes

> ⚠️ **Important**: This project is in early development and intended for internal use. Ensure proper network isolation, authentication, and access controls before exposing to production traffic.

### Support

As this is an early-stage internal tool, community support is limited. Review the existing documentation and configuration files for guidance, or adapt the deployment to your specific infrastructure requirements.
