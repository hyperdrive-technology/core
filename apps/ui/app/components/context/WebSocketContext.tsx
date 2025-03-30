import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
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
  connectingControllers: Set<string>;
  setSelectedVariable: (variable: string | null) => void;
  connect: (controllerId?: string) => void;
  disconnect: (controllerId?: string) => void;
  connectAll: () => void;
  disconnectAll: () => void;
  addController: (id: string, name: string, ip: string) => void;
  getControllerStatus: (controllerId: string) => boolean;
  isControllerConnecting: (controllerId: string) => boolean;
  subscribeToVariables: (variableNames: string[], filePath: string) => void;
  setTrendTabOpen: (isOpen: boolean) => void;
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
  const [subscribedVariables, setSubscribedVariables] = useState<Set<string>>(
    new Set()
  );
  const [connectingControllers, setConnectingControllers] = useState<
    Set<string>
  >(new Set());

  // Refs for logging throttling
  const lastLogTimeRef = useRef<number | null>(null);
  const prevVariableCountRef = useRef<number>(0);
  // Ref to track if we've shown the auto-connect toast to avoid showing it on initial page load
  const hasShownAutoConnectToast = useRef<boolean>(false);
  // Flag to track if there are open trend tabs requiring variable data
  const hasTrendTabsOpen = useRef<boolean>(false);

  // Initialize the default controller - REMOVED
  /*
  useEffect(() => {
    // Check if we already have controllers
    if (controllers.length === 0) {
      console.log('Adding default localhost controller');
      const defaultController = {
        id: 'default',
        name: 'Local Controller',
        ip: 'localhost',
        isConnected: false,
        connection: null,
      };

      setControllers([defaultController]);

      // Connect to it after a short delay
      setTimeout(() => {
        console.log('Attempting to connect to default controller');
        connectToController('default', 'localhost');
      }, 1000);
    }
  }, []);
  */

  // Log state changes for debugging
  useEffect(() => {
    // Reduce logging frequency - only log once per 15 seconds at most (increased from 5)
    // Use ref to track last log time without triggering effect
    if (!lastLogTimeRef.current) {
      lastLogTimeRef.current = Date.now();
    }

    const now = Date.now();
    const timeSinceLastLog = now - lastLogTimeRef.current;

    // Only log if it's been at least 15 seconds since the last log
    // or if the variable count changes significantly (by 5 or more)
    const varCountChange = Math.abs(
      prevVariableCountRef.current - Object.keys(variables).length
    );

    if (timeSinceLastLog > 15000 || varCountChange >= 5) {
      // Removed console log to reduce console spam
      lastLogTimeRef.current = now;
      prevVariableCountRef.current = Object.keys(variables).length;
    }
  }, [isConnected, controllers, variables]);

  // Add debugging log for connection state
  useEffect(() => {
    console.log('WebSocketContext state:');
    console.log('- Connecting controllers:', [...connectingControllers]);
    console.log('- Controllers:', controllers);
  }, [connectingControllers, controllers]);

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
      connectAll();
      return;
    }

    // Connect to a specific controller
    const controller = controllers.find((c) => c.id === controllerId);
    if (!controller) {
      toast.error(`Controller ${controllerId} not found`);
      return;
    }

    if (controller.isConnected) {
      console.log(`Already connected to ${controller.name}`);
      return;
    }

    // Check if already connecting to this controller
    if (connectingControllers.has(controllerId)) {
      console.log(
        `Already connecting to ${controller.name}, ignoring duplicate request`
      );
      return;
    }

    // Mark this controller as connecting BEFORE creating the WebSocket
    setConnectingControllers((prev) => {
      const updated = new Set(prev);
      updated.add(controllerId);
      console.log(
        `Adding ${controllerId} to connecting controllers. Current set:`,
        [...updated]
      );
      return updated;
    });

    // Small delay to ensure state update before connection attempt
    setTimeout(() => {
      connectToController(controller.id, controller.ip);
    }, 10);
  };

  // Connect to all controllers
  const connectAll = () => {
    console.log('Connecting to all controllers');

    // First, identify which controllers need connecting
    const controllersToConnect = controllers.filter(
      (controller) => !controller.isConnected
    );

    if (controllersToConnect.length === 0) {
      console.log('All controllers are already connected');
      return;
    }

    // Log controllers to connect
    console.log(
      'Controllers to connect:',
      controllersToConnect.map((c) => c.id)
    );

    // Mark all controllers as connecting first
    setConnectingControllers((prev) => {
      const updated = new Set(prev);
      controllersToConnect.forEach((controller) => {
        updated.add(controller.id);
        console.log(
          `Adding ${controller.id} to connecting controllers for connectAll()`
        );
      });
      console.log('Updated connecting controllers:', [...updated]);
      return updated;
    });

    // Delay the connection attempts slightly to ensure state updates first
    setTimeout(() => {
      controllersToConnect.forEach((controller) => {
        // We're already marked as connecting, so call connectToController directly
        console.log(
          `Starting connection to ${controller.id} (${controller.ip})`
        );
        connectToController(controller.id, controller.ip);
      });
      console.log(
        `Started connecting to ${controllersToConnect.length} controller(s)...`
      );
    }, 50);
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
        console.log('No active connections to disconnect');
      } else {
        console.log(`Disconnected from ${disconnectedCount} controller(s)`);
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
      console.log(`Not connected to ${controller.name}`);
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

      console.log(`Disconnected from ${controller.name}`);

      // If no controllers are connected, set the global status to disconnected
      setIsConnected(controllers.some((c) => c.isConnected));
    }
  };

  // Disconnect from all controllers
  const disconnectAll = () => {
    console.log('Disconnecting from all controllers');
    controllers.forEach((controller) => {
      if (controller.isConnected) {
        disconnect(controller.id);
      }
    });
  };

  // Connect to a specific controller
  const connectToController = (controllerId: string, ip: string) => {
    // Use the constant port for the WebSocket URL
    const wsUrl = `ws://${ip}:${HYPERDRIVE_PORT}/ws`;

    try {
      // Skip showing initial connection toast to reduce UI clutter
      // Just log to console instead
      console.log(`Connecting to ${ip}:${HYPERDRIVE_PORT}...`);

      const ws = new WebSocket(wsUrl);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log(`Connection to ${ip}:${HYPERDRIVE_PORT} timed out`);
          ws.close();

          // Update controller status to disconnected
          setTimeout(() => {
            // Mark controller as no longer connecting
            setConnectingControllers((prev) => {
              const updated = new Set(prev);
              updated.delete(controllerId);
              console.log(
                `Removing ${controllerId} from connecting controllers after timeout`
              );
              return updated;
            });

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
          // Remove from connecting controllers
          setConnectingControllers((prev) => {
            const updated = new Set(prev);
            updated.delete(controllerId);
            return updated;
          });

          setControllers((prev) =>
            prev.map((c) =>
              c.id === controllerId ? { ...c, isConnected: true } : c
            )
          );

          // Set global connected status if at least one controller is connected
          setIsConnected(true);

          setError(null);

          // Only show connection toast if it wasn't auto-connected on page load
          // If this is the default controller and this is the first connection attempt, don't show the toast
          const isAutoConnect =
            controllerId === 'default' && !hasShownAutoConnectToast.current;
          if (!isAutoConnect) {
            console.log(`Connected to ${ip}:${HYPERDRIVE_PORT}`);
          }

          // Mark that we've shown the auto-connect toast
          if (controllerId === 'default') {
            hasShownAutoConnectToast.current = true;
          }
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

              // Process variables without excessive logging
              Object.entries(data.variables).forEach(
                ([path, vars]: [string, any]) => {
                  const controllerPath = `${controllerId}:${path}`;
                  controllerVariables[controllerPath] = vars;
                }
              );

              // Merge with existing variables
              setVariables((prev) => {
                const merged = {
                  ...prev,
                  ...controllerVariables,
                };

                return merged;
              });

              // Update history data for charting only if we have numeric variables
              let hasNumericVars = false;
              const timestamp = new Date().toISOString();
              const newPoint: any = { timestamp };

              // Add all numeric variables to the chart data
              Object.values(data.variables).forEach((varGroup: any) => {
                varGroup.forEach((variable: Variable) => {
                  // Convert the value to a number for numeric types
                  let numericValue: number | null = null;

                  // Check if the value is already a number or can be converted to one
                  if (typeof variable.Value === 'number') {
                    numericValue = variable.Value;
                  } else if (
                    typeof variable.Value === 'string' ||
                    typeof variable.Value === 'boolean'
                  ) {
                    // Handle time duration strings (e.g. "1.499788s")
                    if (
                      typeof variable.Value === 'string' &&
                      variable.Value.endsWith('s')
                    ) {
                      // Remove the 's' suffix and convert to number
                      const timeString = variable.Value.slice(0, -1);
                      numericValue = parseFloat(timeString);
                    } else {
                      // Try to convert string or boolean to number
                      const parsed = Number(variable.Value);
                      if (!isNaN(parsed)) {
                        numericValue = parsed;
                      }
                    }
                  }

                  if (numericValue !== null) {
                    hasNumericVars = true;
                    const varKey = `${controllerId}:${variable.Name}`;
                    // Store both the namespaced and plain variable name for flexible access
                    newPoint[varKey] = numericValue;
                    // Also add without controller prefix for easier access
                    newPoint[variable.Name] = numericValue;
                  } else {
                    // For non-numeric values, also add the raw value so it can be processed later
                    if (typeof variable.Value === 'string') {
                      const varKey = `${controllerId}:${variable.Name}`;
                      newPoint[varKey] = variable.Value;
                      newPoint[variable.Name] = variable.Value;
                      hasNumericVars = true; // Still update history for string values
                    }
                  }
                });
              });

              // Only update history if we have numeric variables
              if (hasNumericVars) {
                setHistoryData((prev) => {
                  const updated = [...prev, newPoint];
                  // Keep last 100 points
                  return updated.slice(-100);
                });
              }
            }
          } else if (data.type === 'deployment') {
            // Handle deployment messages
            console.log(`Deployment event: ${data.path}`);
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
          // Remove from connecting controllers
          setConnectingControllers((prev) => {
            const updated = new Set(prev);
            updated.delete(controllerId);
            return updated;
          });

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
          // Remove from connecting controllers
          setConnectingControllers((prev) => {
            const updated = new Set(prev);
            updated.delete(controllerId);
            console.log(
              `Removing ${controllerId} from connecting controllers after close, code: ${event.code}`
            );
            return updated;
          });

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
            console.log(`Disconnected from ${ip}:${HYPERDRIVE_PORT}`);
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

  // Wrap subscribeToVariables in useCallback
  const subscribeToVariables = useCallback(
    (variableNames: string[], filePath: string) => {
      console.log(
        `Subscribing to variables: ${variableNames.join(', ')} from ${filePath}`
      );

      // Add to the global set of subscribed variables
      setSubscribedVariables((prev) => {
        const newSet = new Set(prev);
        variableNames.forEach((name) => newSet.add(name));
        return newSet;
      });

      // Send subscription message to each connected controller
      controllers.forEach((controller) => {
        if (controller.isConnected && controller.connection) {
          try {
            const message = {
              type: 'subscribe',
              variables: variableNames,
              path: filePath, // Send the path for context
            };
            controller.connection.send(JSON.stringify(message));
            console.log(
              `Sent subscription request to ${controller.name}`,
              message
            );
          } catch (err) {
            console.error(
              `Failed to send subscription to ${controller.name}:`,
              err
            );
          }
        }
      });
    },
    [controllers] // Dependency: only recreate if controllers array changes
  );

  // Check if a controller is currently connecting
  const isControllerConnecting = (controllerId: string) => {
    const isConnecting = connectingControllers.has(controllerId);
    return isConnecting;
  };

  // Update hasTrendTabsOpen flag
  const setTrendTabOpen = useCallback((isOpen: boolean) => {
    hasTrendTabsOpen.current = isOpen;
    console.log(`Trend tab open status: ${isOpen}`);
  }, []);

  const contextValue = {
    variables,
    status,
    historyData,
    isConnected,
    error,
    selectedVariable,
    controllers,
    connectingControllers,
    setSelectedVariable,
    connect,
    disconnect,
    connectAll,
    disconnectAll,
    addController,
    getControllerStatus,
    isControllerConnecting,
    subscribeToVariables, // Use the memoized function
    setTrendTabOpen,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
