# Better Bull Board

## What we store
- **Queues**: via polling
- **Schedulers**: via polling
- **Jobs**: via ingestion
- **Jobs Logs**: via ingestion
- **Workers**: via ingestion

## How does this work?
There's two main notions in this project:

- **Polling**: This process is used for long living data in redis like Queues and Schedulers.
- **Ingestion**: For huge amount of data, we use a different approach. We use a Redis Streams to ingest the data.

### Why not use ingestion everywhere?
Because we want to keep the use of this tool simple wrapping all your queues with the bbb client can be a pain.
Also there's no way to know if the queue / scheduler still exists or not when you delete it if we use ingestion.