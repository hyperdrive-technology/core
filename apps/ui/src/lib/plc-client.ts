import { type PLCValue } from "~/types/plc";

interface PLCMessage {
  type: "subscribe" | "unsubscribe" | "write" | "update";
  payload?: any;
}

interface PLCSubscription {
  tags: string[];
  onUpdate: (values: PLCValue[]) => void;
}

export class PLCClient {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, PLCSubscription> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly wsUrl: string;

  constructor(wsUrl: string = "ws://localhost:3000/ws") {
    this.wsUrl = wsUrl;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.addEventListener("open", () => {
      console.log("Connected to PLC WebSocket");
      this.resubscribeAll();
    });

    this.ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data) as PLCMessage;
        if (message.type === "update") {
          this.handleUpdate(message.payload);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    this.ws.addEventListener("close", () => {
      console.log("PLC WebSocket connection closed");
      this.scheduleReconnect();
    });

    this.ws.addEventListener("error", (error) => {
      console.error("PLC WebSocket error:", error);
      this.scheduleReconnect();
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  subscribe(id: string, tags: string[], onUpdate: (values: PLCValue[]) => void) {
    this.subscriptions.set(id, { tags, onUpdate });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "subscribe",
        payload: { tags }
      }));
    }

    return () => this.unsubscribe(id);
  }

  unsubscribe(id: string) {
    const subscription = this.subscriptions.get(id);
    if (subscription && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "unsubscribe",
        payload: { tags: subscription.tags }
      }));
    }
    this.subscriptions.delete(id);
  }

  writeTag(name: string, value: number | boolean | string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "write",
        payload: { tag: name, value }
      }));
    }
  }

  private handleUpdate(values: PLCValue[]) {
    for (const subscription of this.subscriptions.values()) {
      const relevantValues = values.filter(v =>
        subscription.tags.includes(v.name)
      );
      if (relevantValues.length > 0) {
        subscription.onUpdate(relevantValues);
      }
    }
  }

  private resubscribeAll() {
    for (const subscription of this.subscriptions.values()) {
      this.ws?.send(JSON.stringify({
        type: "subscribe",
        payload: { tags: subscription.tags }
      }));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }
}
