# Kubernetes

Manifests live in `k8s/`. App and ingest images for this repo are built and rolled out from `main` by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Architecture

- **PostgreSQL** (in-cluster): custom image with pgvector, PostGIS, pg_uuidv7 (`k8s/03-postgres.yaml`)
- **ClickHouse** (external): analytics for job metrics and logs — not in these manifests; set `CLICKHOUSE_URL` in `k8s/.env`
- **Redis / Dragonfly** (external): queues and caching — not in these manifests
- **App**: Next.js UI (`deployment/bbb-app`)
- **Ingest**: Redis Streams consumer (`statefulset/bbb-ingest`)

Both app and ingest are horizontally scalable. Job and log events are partitioned with Redis Streams consumer groups; periodic maintenance uses Redis locks.

## Prerequisites

- Kubernetes cluster (`kubectl` configured)
- Ingress controller (nginx-ingress recommended)
- Cert-manager or another TLS termination path (optional)
- External Redis/Dragonfly
- External ClickHouse
- Container registry for images (this repo uses `public.ecr.aws/n5q7l0s4`)

## Deploy

Copy `k8s/.env.example` to `k8s/.env` and fill in secrets, Redis, ClickHouse, and domains.

```bash
set -a && source k8s/.env && set +a
envsubst < k8s/02-secrets-configmap.yaml.template > k8s/02-secrets-configmap.yaml
kubectl apply -f k8s/
```

Point `k8s/04-app.yaml` and `k8s/05-ingest.yaml` at your registry if you are not using the public ECR images. Postgres uses `public.ecr.aws/n5q7l0s4/better-bull-board-postgres:latest`; rebuild that image only when `.docker/db` changes — see [Docker images](docker-build.md).

`deploy.yml` does not apply the manifests: it points `bbb-app` and `bbb-ingest` at the images tagged with the deployed commit (`kubectl set image`) and waits for the rollout. Apply the manifests again whenever `k8s/` changes; they reference `:latest`, the last image built from `main`, until the next deploy pins the commit again.

To roll back, `kubectl rollout undo deployment/bbb-app -n better-bull-board` (and `statefulset/bbb-ingest`) returns to the previous commit's image.

## Database migrations

Migrations are SQL files in `packages/db/drizzle`, listed in `packages/db/drizzle/meta/_journal.json`. Since `0012` they are written by hand (there are no drizzle snapshots after `0011`, so `db:generate` would produce a wrong diff): add the SQL file and its journal entry, and keep `packages/db/src/schemas` in sync.

The ingest applies them when it starts with `ENV=production` (`drizzle-kit migrate` under a Postgres advisory lock), so they reach production on the next deploy from `main`. Ingestion is paused meanwhile: events wait in the Redis Streams and are caught up afterwards. The ingest `startupProbe` allows up to 30 minutes before Kubernetes restarts the pod.

`drizzle-kit migrate` runs each migration in a transaction, so an index cannot be built `CONCURRENTLY` there and blocks writes to its table while it builds. For an index on a large table such as `job_runs`, create it by hand with `CREATE INDEX CONCURRENTLY IF NOT EXISTS` before the deploy, and use `IF NOT EXISTS` in the migration.

Locally, run them with `bun run --cwd packages/db db:migrate`.

## Verify

```bash
kubectl get pods,svc,ingress -n better-bull-board
kubectl logs -f deployment/bbb-app -n better-bull-board
kubectl logs -f statefulset/bbb-ingest -n better-bull-board
```

> This project is in early development and intended for internal use. Isolate the cluster, keep auth enabled, and do not expose it to untrusted traffic without extra controls.
