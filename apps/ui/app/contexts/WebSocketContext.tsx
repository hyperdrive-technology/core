import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Define the types for our WebSocket context
export interface WebSocketContextType {
  connected: boolean;
  sendMessage: (message: Record<string, any>) => void;
  addMessageListener: (listener: (data: any) => void) => void;
  removeMessageListener: (listener: (data: any) => void) => void;
  lastMessage: any;
  error: string | null;
}

// Create the context with default values
export const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  sendMessage: () => {},
  addMessageListener: () => {},
  removeMessageListener: () => {},
  lastMessage: null,
  error: null,
});

interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
}

/**
 * WebSocketProvider provides real-time communication with the PLC runtime
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = 'ws://localhost:8080',
}) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const messageListeners = useMemo(() => new Set<(data: any) => void>(), []);

  // Function to send a message through the WebSocket
  const sendMessage = useCallback(
    (message: Record<string, any>) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      } else {
        console.error('WebSocket is not connected');
        setError('WebSocket is not connected');
      }
    },
    [socket]
  );

  // Function to add a message listener
  const addMessageListener = useCallback(
    (listener: (data: any) => void) => {
      messageListeners.add(listener);
    },
    [messageListeners]
  );

  // Function to remove a message listener
  const removeMessageListener = useCallback(
    (listener: (data: any) => void) => {
      messageListeners.delete(listener);
    },
    [messageListeners]
  );

  // Initialize WebSocket connection
  useEffect(() => {
    // Simulate connecting to a PLC via WebSocket for development purposes
    // In a real app, we would connect to a real WebSocket server
    const ws = new WebSocket(url);

    // Set up event handlers
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setError(null);
    };

    ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      setConnected(false);
      setError('Connection closed');

      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        // This component will remount and try to reconnect
      }, 5000);
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);

        // Notify all listeners
        messageListeners.forEach((listener) => {
          try {
            listener(data);
          } catch (error) {
            console.error('Error in message listener:', error);
          }
        });
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Store the socket in state
    setSocket(ws);

    // Clean up on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [url, messageListeners]);

  // Create a mocked WebSocket for development without a real backend
  // In a real app, this would be removed and we'd use the actual WebSocket
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !window.WebSocket) {
      // This simulates WebSocket responses for local development
    }
  }, [socket, sendMessage]);

  // Provide the WebSocket context to children
  const contextValue: WebSocketContextType = {
    connected,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    lastMessage,
    error,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook for easier access to the WebSocket context
export const useWebSocket = () => {
  const context = React.useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
