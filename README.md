# Better Bull Board

> **⚠️ Early Stage Project**: This project is in early development stage and is designed for internal use. Documentation and features may be incomplete or subject to significant changes. Use at your own discretion.

## What we store
- **Queues**: via polling
- **Schedulers**: via polling
- **Jobs**: via Redis Streams ingestion and periodic reconciliation
- **Jobs Logs**: via ingestion

## MCP for agents

Better Bull Board exposes an MCP server for agent access to queues, jobs, logs, and system health. Agents can use it to answer operational questions like which queues are busiest, why jobs are failing, or what is currently running. With write access, agents can also pause and resume queues, cancel jobs, replay jobs, and delete queues.

See the [MCP guide](packages/mcp/README.md) for setup instructions, Cursor/Codex examples, and common prompts.

## How does this work?
There's two main notions in this project:

- **Polling**: This process is used for long living data in redis like Queues and Schedulers.
- **Ingestion**: For huge amount of data, we use Redis Streams consumer groups to ingest durable job events.
- **Reconciliation**: Jobs are periodically checked against BullMQ state so missed or stale rows in Postgres are repaired.

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

`@better-bull-board/client` is published to npm from `main` by [`.github/workflows/publish.yml`](.github/workflows/publish.yml). Merging `develop` into `main` publishes that version if it is not already on npm; otherwise the job skips.

1. Bump `version` in `packages/client/package.json` and merge that change to `develop`.
2. Merge `develop` into `main` (or run **Publish** → **Run workflow** on `main`).

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub OIDC). There is no `NPM_TOKEN`. Before the first successful run, add a GitHub Actions trusted publisher on the [package settings](https://www.npmjs.com/package/@better-bull-board/client?activeTab=settings):

- Organization: `dimension-studios-inc`
- Repository: `better-bull-board`
- Workflow filename: `publish.yml`
- Environment: leave empty
- Allowed actions: `npm publish`

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
- **Ingest Service**: Horizontally scalable for job and job log ingestion. Job and log events are distributed with Redis Streams consumer groups; periodic maintenance uses Redis locks.
- **Database**: Use managed services (AWS RDS, etc.) for production
- **ClickHouse**: Consider clustering for high-volume deployments

### Security Notes

> ⚠️ **Important**: This project is in early development and intended for internal use. Ensure proper network isolation, authentication, and access controls before exposing to production traffic.

### Support

As this is an early-stage internal tool, community support is limited. Review the existing documentation and configuration files for guidance, or adapt the deployment to your specific infrastructure requirements.
