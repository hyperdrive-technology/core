import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface Variable {
  Name: string;
  DataType: number;
  Value: any;
  Quality: number;
  Timestamp: string;
  Path: string;
}

interface VariableMap {
  [path: string]: Variable[];
}

interface RuntimeStatus {
  scanTime: number;
  lastScan: string;
  variableCount: number;
  taskCount: number;
  status: string;
}

interface WebSocketContextType {
  variables: VariableMap;
  status: RuntimeStatus | null;
  historyData: any[];
  isConnected: boolean;
  error: string | null;
  selectedVariable: string | null;
  setSelectedVariable: (variable: string | null) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  variables: {},
  status: null,
  historyData: [],
  isConnected: false,
  error: null,
  selectedVariable: null,
  setSelectedVariable: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [variables, setVariables] = useState<VariableMap>({});
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Create WebSocket connection
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'update') {
            if (data.status) {
              setStatus(data.status);
            }

            if (data.variables) {
              setVariables(data.variables);

              // Update history data for charting
              const timestamp = new Date().toISOString();
              const newPoint: any = { timestamp };

              // Add all numeric variables to the chart data
              Object.values(data.variables).forEach((varGroup: any) => {
                varGroup.forEach((variable: Variable) => {
                  if (typeof variable.Value === 'number') {
                    newPoint[variable.Name] = variable.Value;
                  }
                });
              });

              setHistoryData((prev) => {
                const updated = [...prev, newPoint];
                // Keep last 100 points
                return updated.slice(-100);
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          setError('Failed to parse data from server');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        // Try to reconnect after a delay
        setTimeout(() => {
          if (document.visibilityState !== 'hidden') {
            connect();
          }
        }, 3000);
      };
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Additional visibility change handler for reconnecting when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        !isConnected &&
        !wsRef.current
      ) {
        // Reconnect if tab becomes visible and we're not connected
        console.log('Tab became visible, reconnecting WebSocket');

        // No need to close again since it's already null at this point
        // Just create a new connection
        const ws = new WebSocket('ws://localhost:3000/ws');
        wsRef.current = ws;
        // ... repeat the setup from the useEffect above
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected]);

  return (
    <WebSocketContext.Provider
      value={{
        variables,
        status,
        historyData,
        isConnected,
        error,
        selectedVariable,
        setSelectedVariable,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
