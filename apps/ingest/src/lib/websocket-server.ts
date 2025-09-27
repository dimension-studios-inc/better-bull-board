import { logger } from "@rharkor/logger";
import { type WebSocket, WebSocketServer } from "ws";
import { env } from "./env";
import { redis } from "./redis";

export interface WebSocketMessage {
  type:
    | "job-refresh"
    | "queue-refresh"
    | "job-scheduler-refresh"
    | "log-refresh";
  data: {
    id?: string;
    queueName?: string;
    jobId?: string;
    schedulerKey?: string;
  };
}

class BullBoardWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private subscriber = redis.duplicate();

  // keep track of last sent events for throttling
  private lastSent = new Map<string, number>();
  private pending = new Map<string, WebSocketMessage>();
  private timers = new Map<string, NodeJS.Timeout>();
  private throttleMs = 1000; // 1s window

  constructor() {
    this.wss = new WebSocketServer({
      port: env.WEBSOCKET_PORT,
      perMessageDeflate: false,
    });
    this.setupWebSocketServer();
    this.setupRedisSubscriber();
  }

  private setupWebSocketServer() {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        logger.error("WebSocket client error", { error });
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      this.sendToClient(ws, {
        type: "job-refresh",
        data: { id: "connected" },
      });
    });

    this.wss.on("listening", () => {
      logger.log(`🚀 WebSocket server listening on port ${env.WEBSOCKET_PORT}`);
    });

    this.wss.on("error", (error) => {
      logger.error("WebSocket server error", { error });
    });
  }

  private async setupRedisSubscriber() {
    try {
      await this.subscriber.connect().catch(() => {});
      await this.subscriber.psubscribe("bbb:ingest:events:*");

      logger.log(`📡 Subscribed to Redis channels: bbb:ingest:events:*`);

      this.subscriber.on("pmessage", (_subscription, channel, message) => {
        this.handleRedisMessage(channel, message);
      });
    } catch (error) {
      logger.error("Failed to setup Redis subscriber for WebSocket", { error });
    }
  }

  private handleRedisMessage(channel: string, message: string) {
    try {
      let wsMessage: WebSocketMessage;

      switch (channel) {
        case "bbb:ingest:events:job-refresh":
          wsMessage = { type: "job-refresh", data: { jobId: message } };
          break;
        case "bbb:ingest:events:queue-refresh":
          wsMessage = { type: "queue-refresh", data: { queueName: message } };
          break;
        case "bbb:ingest:events:job-scheduler-refresh":
          wsMessage = {
            type: "job-scheduler-refresh",
            data: { schedulerKey: message },
          };
          break;
        case "bbb:ingest:events:log-refresh":
          wsMessage = { type: "log-refresh", data: { jobId: message } };
          break;
        default:
          logger.warn("Unknown Redis channel", { channel });
          return;
      }

      this.broadcast(wsMessage);
    } catch (error) {
      logger.error("Error handling Redis message", { error, channel, message });
    }
  }

  private broadcast(message: WebSocketMessage) {
    const key = `${message.type}:${JSON.stringify(message.data)}`;
    const now = Date.now();
    const last = this.lastSent.get(key) ?? 0;

    if (now - last >= this.throttleMs) {
      // enough time passed → send immediately
      this.sendToAll(message);
      this.lastSent.set(key, now);
    } else {
      // inside throttle window → queue as pending
      this.pending.set(key, message);

      if (!this.timers.has(key)) {
        const wait = this.throttleMs - (now - last);
        this.timers.set(
          key,
          setTimeout(() => {
            const pendingMsg = this.pending.get(key);
            if (pendingMsg) {
              this.sendToAll(pendingMsg);
              this.lastSent.set(key, Date.now());
              this.pending.delete(key);
            }
            this.timers.delete(key);
          }, wait),
        );
      }
    }
  }

  private sendToAll(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          logger.error("Error sending message to WebSocket client", { error });
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });
  }

  private sendToClient(client: WebSocket, message: WebSocketMessage) {
    if (client.readyState === client.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        logger.error("Error sending message to specific WebSocket client", {
          error,
        });
        this.clients.delete(client);
      }
    }
  }

  public getConnectionCount(): number {
    return this.clients.size;
  }

  public async close() {
    logger.log("Closing WebSocket server...");
    // Close all client connections
    this.clients.forEach((client) => {
      client.close();
    });
    this.clients.clear();
    this.wss.close();
    await this.subscriber.quit();
  }
}

export let websocketServer: BullBoardWebSocketServer | null = null;

export const startWebSocketServer = () => {
  if (!websocketServer) {
    websocketServer = new BullBoardWebSocketServer();
  }
  return websocketServer;
};

export const stopWebSocketServer = async () => {
  if (websocketServer) {
    await websocketServer.close();
    websocketServer = null;
  }
};
