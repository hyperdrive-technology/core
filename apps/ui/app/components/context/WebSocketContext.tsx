import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Define the constant port for all controller connections
export const HYPERDRIVE_PORT = 4444;

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

interface Controller {
  id: string;
  name: string;
  ip: string;
  isConnected: boolean;
  connection: WebSocket | null;
}

interface WebSocketContextType {
  variables: VariableMap;
  status: RuntimeStatus | null;
  historyData: any[];
  isConnected: boolean;
  error: string | null;
  selectedVariable: string | null;
  controllers: Controller[];
  setSelectedVariable: (variable: string | null) => void;
  connect: (controllerId?: string) => void;
  disconnect: (controllerId?: string) => void;
  addController: (id: string, name: string, ip: string) => void;
  getControllerStatus: (controllerId: string) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

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
  const [controllers, setControllers] = useState<Controller[]>([]);

  // Add a new controller to the list or update an existing one
  const addController = (id: string, name: string, ip: string) => {
    setControllers((prev) => {
      // Check if controller already exists
      const existingIndex = prev.findIndex((c) => c.id === id);

      if (existingIndex >= 0) {
        // Check if anything actually changed before updating
        const existing = prev[existingIndex];
        if (existing.name === name && existing.ip === ip) {
          // No changes needed, return the original array to prevent an unnecessary update
          return prev;
        }

        // Update existing controller
        const updated = [...prev];
        // Preserve connection and connected status, update other fields
        updated[existingIndex] = {
          ...updated[existingIndex],
          name,
          ip, // Update the IP
        };

        console.log(`Updated controller ${name} with new IP: ${ip}`);
        return updated;
      }

      // Add new controller
      return [
        ...prev,
        {
          id,
          name,
          ip,
          isConnected: false,
          connection: null,
        },
      ];
    });
  };

  // Get connection status for a specific controller
  const getControllerStatus = (controllerId: string): boolean => {
    const controller = controllers.find((c) => c.id === controllerId);
    return controller ? controller.isConnected : false;
  };

  // Connect to a specific controller or all controllers
  const connect = (controllerId?: string) => {
    // If no controllerId is provided, connect to all controllers
    if (!controllerId) {
      if (controllers.length === 0) {
        toast.error('No controllers found to connect to');
        return;
      }

      let connectedCount = 0;

      // Connect to all controllers
      controllers.forEach((controller) => {
        if (!controller.isConnected) {
          connectToController(controller.id, controller.ip);
          connectedCount++;
        }
      });

      if (connectedCount === 0) {
        toast.info('All controllers are already connected');
      } else {
        toast.info(`Connecting to ${connectedCount} controller(s)...`);
      }

      return;
    }

    // Connect to a specific controller
    const controller = controllers.find((c) => c.id === controllerId);
    if (!controller) {
      toast.error(`Controller ${controllerId} not found`);
      return;
    }

    if (controller.isConnected) {
      toast.info(`Already connected to ${controller.name}`);
      return;
    }

    connectToController(controller.id, controller.ip);
  };

  // Disconnect from a specific controller or all controllers
  const disconnect = (controllerId?: string) => {
    // If no controllerId is provided, disconnect from all controllers
    if (!controllerId) {
      let disconnectedCount = 0;

      controllers.forEach((controller) => {
        if (controller.isConnected && controller.connection) {
          controller.connection.close();
          disconnectedCount++;

          // Update controller status
          setControllers((prev) =>
            prev.map((c) =>
              c.id === controller.id
                ? { ...c, isConnected: false, connection: null }
                : c
            )
          );
        }
      });

      if (disconnectedCount === 0) {
        toast.info('No active connections to disconnect');
      } else {
        toast.info(`Disconnected from ${disconnectedCount} controller(s)`);
      }

      // If no controllers are connected, set the global status to disconnected
      setIsConnected(controllers.some((c) => c.isConnected));

      return;
    }

    // Disconnect from a specific controller
    const controller = controllers.find((c) => c.id === controllerId);
    if (!controller) {
      toast.error(`Controller ${controllerId} not found`);
      return;
    }

    if (!controller.isConnected) {
      toast.info(`Not connected to ${controller.name}`);
      return;
    }

    if (controller.connection) {
      controller.connection.close();

      // Update controller status
      setControllers((prev) =>
        prev.map((c) =>
          c.id === controllerId
            ? { ...c, isConnected: false, connection: null }
            : c
        )
      );

      toast.info(`Disconnected from ${controller.name}`);

      // If no controllers are connected, set the global status to disconnected
      setIsConnected(controllers.some((c) => c.isConnected));
    }
  };

  // Connect to a specific controller
  const connectToController = (controllerId: string, ip: string) => {
    // Use the constant port for the WebSocket URL
    const wsUrl = `ws://${ip}:${HYPERDRIVE_PORT}/ws`;

    try {
      // Make initial connection toast more visible
      toast.info(`Connecting to ${ip}:${HYPERDRIVE_PORT}...`, {
        id: `connect-${controllerId}`,
        duration: 5000, // Show for 5 seconds
        description: 'Attempting to establish WebSocket connection',
      });

      const ws = new WebSocket(wsUrl);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log(`Connection to ${ip}:${HYPERDRIVE_PORT} timed out`);
          ws.close();

          // Update controller status to disconnected
          setTimeout(() => {
            setControllers((prev) =>
              prev.map((c) =>
                c.id === controllerId
                  ? { ...c, isConnected: false, connection: null }
                  : c
              )
            );

            // Show an error toast with longer duration for visibility
            toast.error(`Connection to ${ip}:${HYPERDRIVE_PORT} timed out`, {
              id: `connect-${controllerId}`, // Use same ID to replace the previous toast
              duration: 8000, // Show for 8 seconds
              description:
                'Please check that the controller is powered on and connected to the network.',
            });
          }, 50);
        }
      }, 3000); // 3 second timeout

      // Store the connection in the controller state
      setControllers((prev) =>
        prev.map((c) => (c.id === controllerId ? { ...c, connection: ws } : c))
      );

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log(
          `WebSocket connection established to ${ip}:${HYPERDRIVE_PORT}`
        );

        // Update controller status with a small delay to avoid React rendering issues
        setTimeout(() => {
          setControllers((prev) =>
            prev.map((c) =>
              c.id === controllerId ? { ...c, isConnected: true } : c
            )
          );

          // Set global connected status if at least one controller is connected
          setIsConnected(true);

          setError(null);
          toast.success(`Connected to ${ip}:${HYPERDRIVE_PORT}`, {
            id: `connect-${controllerId}`, // Use same ID to replace the previous toast
            duration: 5000,
          });
        }, 50);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'update') {
            if (data.status) {
              setStatus(data.status);
            }

            if (data.variables) {
              // Add the controller ID to the variable path
              const controllerVariables: VariableMap = {};
              Object.entries(data.variables).forEach(
                ([path, vars]: [string, any]) => {
                  controllerVariables[`${controllerId}:${path}`] = vars;
                }
              );

              // Merge with existing variables
              setVariables((prev) => ({
                ...prev,
                ...controllerVariables,
              }));

              // Update history data for charting
              const timestamp = new Date().toISOString();
              const newPoint: any = { timestamp };

              // Add all numeric variables to the chart data
              Object.values(data.variables).forEach((varGroup: any) => {
                varGroup.forEach((variable: Variable) => {
                  if (typeof variable.Value === 'number') {
                    newPoint[`${controllerId}:${variable.Name}`] =
                      variable.Value;
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
          toast.error('Failed to parse data from server');
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error(`WebSocket error for ${ip}:${HYPERDRIVE_PORT}:`, error);

        // Update controller status to show as disconnected
        setTimeout(() => {
          setControllers((prev) =>
            prev.map((c) =>
              c.id === controllerId
                ? { ...c, isConnected: false, connection: null }
                : c
            )
          );

          // If no controllers are connected, set the global status to disconnected
          const remainingConnections = controllers.filter(
            (c) => c.isConnected && c.id !== controllerId
          );
          setIsConnected(remainingConnections.length > 0);

          toast.error(`Failed to connect to ${ip}:${HYPERDRIVE_PORT}`, {
            id: `connect-${controllerId}`, // Use same ID to replace the previous toast
            duration: 8000, // Show for longer
            description:
              'Please verify the IP address and check that the controller is online.',
          });
        }, 50);
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`WebSocket connection closed for ${ip}:${HYPERDRIVE_PORT}`);

        // Update controller status with a small delay
        setTimeout(() => {
          setControllers((prev) =>
            prev.map((c) =>
              c.id === controllerId
                ? { ...c, isConnected: false, connection: null }
                : c
            )
          );

          // If no controllers are connected, set the global status to disconnected
          const remainingConnections = controllers.filter(
            (c) => c.isConnected && c.id !== controllerId
          );
          setIsConnected(remainingConnections.length > 0);

          if (event.code !== 1006) {
            // 1006 is abnormal closure, which we handle differently
            toast.info(`Disconnected from ${ip}:${HYPERDRIVE_PORT}`, {
              id: `connect-${controllerId}`,
            });
          } else {
            // This is likely a connection failure, not a clean disconnect
            console.log('Connection failed with code 1006 (Abnormal Closure)');
            toast.error(`Connection to ${ip}:${HYPERDRIVE_PORT} failed`, {
              id: `connect-${controllerId}`,
              duration: 8000,
              description:
                'Unable to establish a connection. Please check network settings.',
            });
          }
        }, 50);
      };

      return ws;
    } catch (error) {
      console.error(
        `Failed to create WebSocket for ${ip}:${HYPERDRIVE_PORT}:`,
        error
      );

      toast.error(`Failed to connect to ${ip}:${HYPERDRIVE_PORT}`, {
        id: `connect-${controllerId}`,
        duration: 8000,
        description:
          'An error occurred while trying to create the WebSocket connection.',
      });

      // Update controller status to show as disconnected
      setControllers((prev) =>
        prev.map((c) =>
          c.id === controllerId
            ? { ...c, isConnected: false, connection: null }
            : c
        )
      );

      return null;
    }
  };

  // No need for initial connection anymore since we'll connect to controllers explicitly
  // with the connect() method when added or when the user clicks the connect button

  // Add a test toast when the component mounts to verify toast functionality
  useEffect(() => {
    // Show a test toast when the provider mounts
    setTimeout(() => {
      toast('Toast notifications are working!', {
        id: 'toast-test',
        description:
          'You should see this message if toasts are configured correctly',
      });
    }, 1000);
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        variables,
        status,
        historyData,
        isConnected,
        error,
        selectedVariable,
        controllers,
        setSelectedVariable,
        connect,
        disconnect,
        addController,
        getControllerStatus,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
