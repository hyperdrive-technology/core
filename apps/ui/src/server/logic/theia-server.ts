import { WebSocket } from "ws";
import { type PLCValue } from "~/types/plc";
import { DEFAULT_WINDOW_CONFIG, THEIA_CONFIG } from "./config";

interface TheiaMessage {
  type: "subscribe" | "unsubscribe" | "write" | "update" | "config";
  payload?: any;
}

export class TheiaServer {
  private wss: WebSocket.Server | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(private readonly port: number = 3000) {}

  start() {
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial configuration
      ws.send(JSON.stringify({
        type: "config",
        payload: {
          window: DEFAULT_WINDOW_CONFIG,
          theia: THEIA_CONFIG
        }
      }));

      ws.on("message", (data: string) => {
        try {
          const message = JSON.parse(data) as TheiaMessage;
          this.handleMessage(ws, message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });
    });

    console.log(`Theia WebSocket server started on port ${this.port}`);
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  handleMessage(ws: WebSocket, message: TheiaMessage) {
    switch (message.type) {
      case "subscribe":
        // Handle tag subscription
        break;
      case "unsubscribe":
        // Handle tag unsubscription
        break;
      case "write":
        // Handle tag write
        break;
      case "update":
        // Handle tag update
        this.broadcastUpdate(message.payload as PLCValue[]);
        break;
      case "config":
        // Handle config request
        ws.send(JSON.stringify({
          type: "config",
          payload: {
            window: DEFAULT_WINDOW_CONFIG,
            theia: THEIA_CONFIG
          }
        }));
        break;
    }
  }

  private broadcastUpdate(values: PLCValue[]) {
    const message = JSON.stringify({
      type: "update",
      payload: values
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
