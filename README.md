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

## Local development

```bash
docker-compose -f .docker/compose.local.yaml up -d
pnpm dev
```

## Docs

- [Kubernetes](docs/kubernetes.md) — cluster layout, `k8s/` manifests, self-hosting
- [Docker images](docs/docker-build.md) — ECR repos, Postgres image, self-hosted app/ingest builds
- [Publishing `@better-bull-board/client`](docs/publishing.md) — registry publish from `main`
