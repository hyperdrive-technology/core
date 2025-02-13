import { MessageType, PLCValue, SubscribeMessage } from '@inrush/protocol';
import { useEffect, useRef, useState } from 'react';

interface PLCConnectionOptions {
  tags: string[];
}

export function usePLCConnection({ tags }: PLCConnectionOptions) {
  const [values, setValues] = useState<Record<string, PLCValue>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_PLC_WS_URL || 'ws://localhost:3000/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      const message: SubscribeMessage = {
        type: MessageType.Subscribe,
        payload: { tags },
      };
      ws.send(JSON.stringify(message));
    });

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === MessageType.Update) {
        setValues((prev) => ({
          ...prev,
          ...message.payload.reduce((acc: Record<string, PLCValue>, update: PLCValue) => {
            acc[update.tag] = update;
            return acc;
          }, {}),
        }));
      }
    });

    ws.addEventListener('close', () => {
      console.log('WebSocket connection closed');
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [tags.join(',')]);

  return values;
}
