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
      logger.debug("New WebSocket client connected");
      this.clients.add(ws);

      ws.on("close", () => {
        logger.debug("WebSocket client disconnected");
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
      await this.subscriber.connect();

      // Subscribe to the events we're emitting in the files
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
          wsMessage = {
            type: "job-refresh",
            data: { jobId: message },
          };
          break;
        case "bbb:ingest:events:queue-refresh":
          wsMessage = {
            type: "queue-refresh",
            data: { queueName: message },
          };
          break;
        case "bbb:ingest:events:job-scheduler-refresh":
          wsMessage = {
            type: "job-scheduler-refresh",
            data: { schedulerKey: message },
          };
          break;
        case "bbb:ingest:events:log-refresh":
          wsMessage = {
            type: "log-refresh",
            data: { jobId: message },
          };
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
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error("Error sending message to WebSocket client", { error });
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });

    if (sentCount > 0) {
      logger.debug(
        `Broadcasted ${message.type} to ${sentCount} clients`,
        message.data,
      );
    }
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

    // Close WebSocket server
    this.wss.close();

    // Close Redis subscriber
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
