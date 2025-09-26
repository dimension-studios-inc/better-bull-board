# WebSocket Real-time Integration

This document explains the WebSocket integration that enables real-time updates in the Better Bull Board frontend.

## Overview

The system consists of:
1. **WebSocket Server** (in ingest app) - Listens to Redis events and broadcasts to connected clients
2. **WebSocket Client** (in frontend app) - Connects to the server and auto-invalidates React Query caches
3. **Redis Events** - Published by the existing ingest processes when data changes

## Architecture

```
Redis Events → WebSocket Server → WebSocket Client → React Query Invalidation → UI Updates
```

### Flow:
1. When jobs, queues, or logs change, the ingest app publishes Redis events
2. WebSocket server listens to these events and broadcasts them to connected clients
3. Frontend WebSocket client receives messages and invalidates relevant React Query caches
4. React Query refetches data and UI updates automatically

## Components

### WebSocket Server (`apps/ingest/src/lib/websocket-server.ts`)

- Runs on port 8081 (configurable via `WEBSOCKET_PORT` env var)
- Subscribes to Redis channels:
  - `bbb:ingest:events:job-refresh`
  - `bbb:ingest:events:queue-refresh` 
  - `bbb:ingest:events:job-scheduler-refresh`
  - `bbb:ingest:events:log-refresh`
- Broadcasts messages to all connected WebSocket clients
- Handles client connections/disconnections gracefully

### WebSocket Client (`apps/app/src/hooks/use-websocket.tsx`)

- Auto-connects to WebSocket server on app load
- Handles reconnection with exponential backoff
- Maps message types to React Query cache invalidations:
  - `job-refresh` → invalidates `["jobs/table"]`, `["jobs/stats"]`
  - `queue-refresh` → invalidates `["queues/table"]`, `["queues/stats"]`
  - `job-scheduler-refresh` → invalidates `["queues/table"]`, `["queues/stats"]`
  - `log-refresh` → invalidates `["jobs/table"]`, `["jobs/stats"]`

### Redis Events

The following files now publish Redis events when data changes:

- `apps/ingest/src/channels/job.ts` - Publishes `job-refresh` events
- `apps/ingest/src/channels/log.ts` - Publishes `job-refresh` and `log-refresh` events  
- `apps/ingest/src/repeats/queues.ts` - Publishes `queue-refresh` and `job-scheduler-refresh` events

## Configuration

### Environment Variables

**Ingest App:**
- `WEBSOCKET_PORT` - WebSocket server port (default: 8081)

**Frontend App:**
- `NEXT_PUBLIC_WEBSOCKET_URL` - WebSocket server URL (default: ws://localhost:8081)

## Testing

### Manual Testing

1. **Start the ingest app:**
   ```bash
   cd apps/ingest
   npm run dev
   ```

2. **Start the frontend app:**
   ```bash
   cd apps/app
   npm run dev
   ```

3. **Open the test client:**
   Open `apps/ingest/debug/websocket-client-test.html` in a browser

4. **Simulate events:**
   ```bash
   cd apps/ingest
   npm run debug -- debug/websocket-test.ts
   ```

### Production Deployment

1. **Configure environment variables:**
   - Set `WEBSOCKET_PORT` for the ingest app
   - Set `NEXT_PUBLIC_WEBSOCKET_URL` for the frontend (e.g., `wss://your-domain.com:8081`)

2. **Ensure WebSocket port is accessible:**
   - Configure firewall/load balancer to allow WebSocket connections
   - For SSL/TLS deployments, use `wss://` protocol

3. **Monitor connections:**
   - WebSocket server logs connection/disconnection events
   - Check logs for any Redis subscription issues

## Message Format

WebSocket messages follow this format:

```typescript
interface WebSocketMessage {
  type: "job-refresh" | "queue-refresh" | "job-scheduler-refresh" | "log-refresh";
  data: {
    id?: string;           // Generic ID
    queueName?: string;    // Queue name for queue events
    jobId?: string;        // Job ID for job/log events  
    schedulerKey?: string; // Scheduler key for scheduler events
  };
}
```

## Error Handling

- **Connection failures:** Client auto-reconnects with exponential backoff
- **Message parsing errors:** Logged and ignored, connection remains active
- **Redis connection issues:** Server logs errors, WebSocket server continues running
- **Client disconnections:** Server cleans up client references automatically

## Performance Considerations

- WebSocket messages are lightweight JSON objects
- React Query intelligently batches cache invalidations
- Only changed data is refetched, not entire datasets
- Connection count is logged for monitoring

## Troubleshooting

### WebSocket Connection Issues

1. **Check if WebSocket server is running:**
   - Look for "🚀 WebSocket server listening on port 8081" in ingest app logs

2. **Verify environment variables:**
   - `WEBSOCKET_PORT` in ingest app
   - `NEXT_PUBLIC_WEBSOCKET_URL` in frontend app

3. **Network connectivity:**
   - Ensure port 8081 is accessible
   - Check firewall settings
   - For production, verify SSL/TLS configuration

### No Real-time Updates

1. **Check Redis events:**
   - Verify Redis is running and accessible
   - Look for "📡 Subscribed to Redis channels" in logs

2. **Check React Query invalidation:**
   - Open browser dev tools and check Network tab
   - Should see API requests when WebSocket messages are received

3. **Verify message flow:**
   - Use the test client (`websocket-client-test.html`) to see raw messages
   - Run the test script to simulate events

## Future Enhancements

- Add authentication/authorization for WebSocket connections
- Implement selective subscriptions (e.g., subscribe only to specific queues)
- Add message compression for high-frequency updates
- Implement WebSocket clustering for horizontal scaling