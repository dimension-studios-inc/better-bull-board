# @better-bull-board/client

Developer documentation for integrating Better Bull Board with your BullMQ workers.

## Installation

```bash
npm install @better-bull-board/client
```

## Usage

To use Better Bull Board with your BullMQ workers, you need to:

1. **Import the BBB client** 
2. **Use a separate processor** (sandboxed processor required for job cancellation)

### Basic Setup

#### 1. Create a Processor File

Create a separate processor file (e.g., `processor.ts` or `processor.js`):

```typescript
import { patch } from "@better-bull-board/client";
import type { SandboxedJob } from "bullmq";
import { redis } from "./lib/redis"; // Your Redis connection

export default patch(async (job: SandboxedJob) => {
  console.log(`Processing job ${job.id}`);
  
  // Your job processing logic here
  await processYourJob(job.data);
  
  console.log(`Job ${job.id} completed`);
  
  return { status: "done" };
}, redis);
```

#### 2. Create a Worker

Use the Better Bull Board Worker class in your main worker file:

```typescript
import path from "node:path";
import { Worker } from "@better-bull-board/client";
import { redis } from "./lib/redis"; // Your Redis connection

const processorFile = path.join(__dirname, "processor.cjs"); // Note: .cjs extension for built files

new Worker("your-queue-name", processorFile, {
  connection: redis,
  ioredis: redis,
  useWorkerThreads: true,
  concurrency: 10,
  getJobTags(job) {
    // Optional: Return tags for better organization
    return ["your-queue", "production"];
  },
});
```

### Key Requirements

- **Separate Processor**: You must use a sandboxed processor (separate file) for job cancellation to work properly
- **Redis Connection**: Provide both `connection` and `ioredis` options pointing to the same Redis instance  
- **Worker Threads**: Set `useWorkerThreads: true` for proper isolation
- **File Extension**: Use `.cjs` extension for the processor file path when referencing built files

### Complete Example

Here's a complete working example based on our demo:

**processor.ts**
```typescript
import { patch } from "@better-bull-board/client";
import type { SandboxedJob } from "bullmq";
import { redis } from "../lib/redis";

export default patch(async (job: SandboxedJob) => {
  console.log(`Processing job ${job.id}`);

  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  console.log(`Job ${job.id} processed`);

  return { status: "done" };
}, redis);
```

**worker.ts**
```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "@better-bull-board/client";
import { redis } from "./lib/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const processorFile = path.join(__dirname, "processor.cjs");

new Worker("demo-queue", processorFile, {
  connection: redis,
  ioredis: redis,
  useWorkerThreads: true,
  concurrency: 10,
  getJobTags() {
    return ["demo-queue", "test"];
  },
});
```

### Advanced Features

#### Job Cancellation

The `patch` function provides built-in job cancellation support. Jobs can be cancelled through the Better Bull Board UI.

#### Console Logging

All console output from your processors is automatically captured and sent to Better Bull Board for monitoring.

#### Job Tags

Use the `getJobTags` function to organize and filter your jobs in the Better Bull Board interface:

```typescript
getJobTags(job) {
  return [
    job.queueName,
    job.data.priority || "normal",
    process.env.NODE_ENV || "development"
  ];
}
```

## API Reference

### `patch(processor, redis)`

Wraps your job processor with Better Bull Board functionality.

- `processor`: Your async job processing function
- `redis`: Redis connection instance

### `Worker`

Extended BullMQ Worker with Better Bull Board integration.

**Required Options:**
- `ioredis`: Redis connection instance
- `useWorkerThreads`: Must be `true`
- `getJobTags`: Optional function to return job tags

## Troubleshooting

- **Job cancellation not working**: Ensure you're using a sandboxed processor (separate file)
- **Jobs not appearing**: Check that your Redis connection is properly configured
- **Build issues**: Make sure to reference `.cjs` files for built processors