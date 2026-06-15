# Better Bull Board MCP

Better Bull Board includes an MCP server so agents can inspect queues, jobs, logs, and high-level system health from the same data shown in the web app. With write access enabled, agents can also pause and resume queues, cancel jobs, replay jobs, and delete queues.

The recommended setup is the app-hosted MCP endpoint:

```txt
https://<your-better-bull-board-host>/mcp
```

For local development, this is usually:

```txt
http://127.0.0.1:3000/mcp
```

## What Agents Can Do

Read access lets an agent:

- Summarize active and waiting jobs across the system.
- List queues and show active or waiting job counts.
- Find recent failed jobs.
- Open a specific job and explain its status, attempts, timing, payload, result, and error.
- Read logs for a job and summarize what happened.

Write access lets an agent:

- Pause or resume a queue.
- Cancel a job.
- Replay a job.
- Delete a queue.

Write actions require the `bbb:write` OAuth scope. The authorization screen shows whether the client is requesting read-only or read/write access before you approve it.

## Connect

Start the Better Bull Board app and make sure you can sign in as an admin. Then add the MCP URL to your client:

```txt
https://<your-better-bull-board-host>/mcp
```

Your MCP client should discover the OAuth metadata, open Better Bull Board in the browser, ask you to authorize access, and store the token automatically. You should not need to copy a bearer token manually for the app-hosted flow.

### Cursor

For local development, click:

[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-1f1f1f?style=for-the-badge)](https://cursor.com/en/install-mcp?name=better-bull-board&config=eyJ1cmwiOiJodHRwOi8vMTI3LjAuMC4xOjMwMDAvbWNwIn0%3D)

For a hosted Better Bull Board instance, go to `Cursor Settings` -> `MCP` -> `New MCP Server`, choose a remote or streamable HTTP server, and use:

```txt
https://<your-better-bull-board-host>/mcp
```

If you want a one-click Cursor link for your own host, base64-encode this JSON and put it in the `config` parameter:

```json
{"url":"https://<your-better-bull-board-host>/mcp"}
```

```txt
https://cursor.com/en/install-mcp?name=better-bull-board&config=<base64-config>
```

### Codex

In Codex, add a new MCP server:

- Name: `Better Bull Board`
- Transport: `Streamable HTTP`
- URL: `https://<your-better-bull-board-host>/mcp`

After saving, Codex should start the browser authorization flow. Approve access in Better Bull Board, then ask Codex to use Better Bull Board.

### Claude, VS Code, Cline, and Other MCP Clients

Use the remote HTTP MCP configuration for your client and set the server URL to:

```txt
https://<your-better-bull-board-host>/mcp
```

Many clients use a JSON shape like this:

```json
{
  "mcpServers": {
    "better-bull-board": {
      "url": "https://<your-better-bull-board-host>/mcp"
    }
  }
}
```

If your client only supports local stdio MCP servers, use the standalone development server instead.

## Standalone Development Server

The app-hosted endpoint is the normal path. The standalone package is useful for local development or clients that do not support remote HTTP MCP yet.

Build the package first:

```bash
npm run build --workspace=@better-bull-board/mcp
```

Then start it:

```bash
npm run start --workspace=@better-bull-board/mcp
```

Standalone mode uses environment variables from `packages/mcp/.env` and requires a bearer token configured manually. Prefer the app-hosted OAuth flow when your client supports it.

## First Prompts

Try these after connecting:

```txt
Give me a quick health summary of the queues. How many jobs are active and waiting?
```

```txt
Which queues look busiest right now? Show me the queues with the most waiting jobs.
```

```txt
Find recent failed jobs and summarize the most common error messages.
```

```txt
Show me what is currently running and call out anything that has been active for a long time.
```

## Read Examples

```txt
List the queues that have waiting jobs and include active counts for each one.
```

```txt
Look at the email queue and tell me whether it is paused, busy, or idle.
```

```txt
Find failed jobs from the last hour and group them by queue.
```

```txt
Open the most recent failed payment job and explain what happened from its logs.
```

```txt
Show me the job logs that mention a timeout.
```

## Write Examples

Use write prompts only when you intend to change BullMQ state.

```txt
Pause the email queue so it stops processing new jobs.
```

```txt
Resume the email queue.
```

```txt
Cancel the stuck job in the image-processing queue with job id 12345.
```

```txt
Replay the failed payment job with job id 98765.
```

```txt
Delete the old test queue named demo-cleanup.
```

## Security Notes

- Only connect MCP clients you trust.
- The MCP server uses the same Better Bull Board admin login as the human authorization step.
- Access tokens are MCP-specific, opaque, and revocable.
- Read access is enough for queue inspection and debugging.
- Write access can change live queue state and should be granted deliberately.

## Troubleshooting

If the client says unauthorized, reconnect the server and complete the browser authorization flow again.

If the client never opens the browser, check that it supports remote Streamable HTTP MCP servers with OAuth.

If the app returns `404` for `/mcp`, make sure you are running the web app, not only the standalone package.

If local development uses a different port, update the MCP URL. For example:

```txt
http://127.0.0.1:3333/mcp
```
