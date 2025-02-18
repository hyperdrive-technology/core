import { BackendApplicationContribution } from "@theia/core/lib/node/backend-application";
import { injectable } from "@theia/core/shared/inversify";
import { WebSocket, WebSocketServer } from "ws";
import { TheiaServer } from "./theia-server";

@injectable()
export class PLCBackendContribution implements BackendApplicationContribution {
  private theiaServer: TheiaServer;

  constructor() {
    this.theiaServer = new TheiaServer();
  }

  initialize() {
    this.theiaServer.start();
  }

  onStop() {
    if (this.theiaServer) {
      this.theiaServer.stop();
    }
  }

  configure(_app: unknown) {
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket connection");

      ws.on("message", async (data: string) => {
        try {
          const message = JSON.parse(data);
          // Forward messages to the Theia server
          this.theiaServer.handleMessage(ws, message);
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        console.log("WebSocket connection closed");
      });
    });
  }
}
