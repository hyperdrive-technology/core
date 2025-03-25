import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Activity, Clock, Filter, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CONTROLLER_API } from '../utils/constants';
import { useWebSocket } from './context/WebSocketContext';
import { FileNode } from './types';

interface TrendsTabProps {
  file: FileNode;
}

// Helper to extract variables from ST code
const extractVariablesFromST = (code: string): string[] => {
  const variables: string[] = [];

  // Simple regex to match variable declarations in ST code
  // Matches: VAR/VAR_INPUT/VAR_OUTPUT sections
  const varSectionRegex =
    /\b(VAR|VAR_INPUT|VAR_OUTPUT|VAR_TEMP|VAR_EXTERNAL|VAR_GLOBAL)\b(.*?)\bEND_VAR\b/gs;

  // Match variable declarations within VAR sections
  // Looks for patterns like: varName : Type; or varName : Type := value;
  const varDeclRegex =
    /\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(?::=.*?)?;/g;

  let varSection;
  while ((varSection = varSectionRegex.exec(code)) !== null) {
    const sectionContent = varSection[2];
    let varDecl;

    while ((varDecl = varDeclRegex.exec(sectionContent)) !== null) {
      if (varDecl[1] && !variables.includes(varDecl[1])) {
        variables.push(varDecl[1]);
      }
    }
  }

  // Also look for standalone variable declarations (outside VAR blocks)
  const globalVarRegex =
    /\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(?::=.*?)?;/g;
  let globalVar;
  while ((globalVar = globalVarRegex.exec(code)) !== null) {
    if (globalVar[1] && !variables.includes(globalVar[1])) {
      variables.push(globalVar[1]);
    }
  }

  return variables;
};

// Helper to fetch a file's content by ID
const fetchFileContent = async (
  fileId: string
): Promise<{ sourceCode: string | null; ast: any | null }> => {
  try {
    // Get the AST from the runtime
    const response = await fetch(CONTROLLER_API.DOWNLOAD_AST(fileId));
    if (!response.ok) {
      console.warn(
        `AST not found for file: ${fileId}. Status: ${response.status} ${response.statusText}`
      );
      return { sourceCode: null, ast: null };
    }

    const data = await response.json();
    return {
      sourceCode: data.sourceCode || null,
      ast: data.ast || null,
    };
  } catch (error) {
    console.error('Error fetching file content:', error);
    return { sourceCode: null, ast: null };
  }
};

// Extract variables from an AST
const extractVariablesFromAST = (ast: any): string[] => {
  const variables: string[] = [];

  if (!ast || typeof ast !== 'object') {
    console.error('Invalid AST format:', ast);
    return variables;
  }

  console.log('Extracting variables from AST:', ast);

  // Try to find declarations in the AST
  try {
    if (ast.declarations && Array.isArray(ast.declarations)) {
      // Iterate through all declarations
      ast.declarations.forEach((decl: any) => {
        if (decl.$type === 'VariableDeclaration' && decl.name) {
          variables.push(decl.name);
        }
      });
    }

    // Check for variables in programs or configurations
    if (ast.programs && Array.isArray(ast.programs)) {
      ast.programs.forEach((program: any) => {
        if (program.localVariables && Array.isArray(program.localVariables)) {
          program.localVariables.forEach((variable: any) => {
            if (variable.name) {
              variables.push(variable.name);
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('Error extracting variables from AST:', error);
  }

  console.log('Extracted variables:', variables);
  return variables;
};

const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#0088fe',
  '#00C49F',
];

export default function TrendsTab({ file }: TrendsTabProps) {
  const {
    isConnected,
    variables: wsVariables,
    historyData,
    subscribeToVariables,
    setTrendTabOpen,
  } = useWebSocket();
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualVariable, setManualVariable] = useState<string>('');
  const [hasAttemptedSubscribe, setHasAttemptedSubscribe] = useState(false);

  // Notify WebSocketContext when the trend tab is opened
  useEffect(() => {
    setTrendTabOpen(true);

    // Clean up when component unmounts
    return () => {
      setTrendTabOpen(false);
    };
  }, [setTrendTabOpen]);

  // Initialize with some default variables based on file name
  useEffect(() => {
    // Set initial loading state
    setLoading(true);

    // Get the file name without extension and path
    const fileName = getFileName(file.name);
    // Default to main-st if we can't determine a namespace
    let namespace = 'main-st';

    // If we have a specific file name, use it for the namespace
    if (fileName && fileName !== 'unknown' && fileName !== 'trends') {
      const baseName = fileName.replace('.st', '').replace('Trends: ', '');
      namespace = `${baseName}-st`;
    }

    console.log(`Using namespace: ${namespace} for trends variables`);

    // Fetch the actual ST code to extract variables
    const fetchSTCode = async () => {
      try {
        // Try to fetch the source code from the controller
        const filePath = namespace.replace('-st', ''); // Get original path without -st suffix
        const response = await fetch(CONTROLLER_API.DOWNLOAD_AST(filePath));
        if (response.ok) {
          const data = await response.json();
          if (data.sourceCode) {
            // Extract variables from the source code
            const extractedVars = extractVariablesFromST(data.sourceCode);
            console.log('Extracted variables from ST code:', extractedVars);

            // Format variables with namespace
            const namespacedVars = extractedVars.map(
              (v) => `${namespace}.${v}`
            );

            if (namespacedVars.length > 0) {
              setAvailableVariables(namespacedVars);
              // Select the first few variables by default
              setSelectedVariables(
                namespacedVars.slice(0, Math.min(4, namespacedVars.length))
              );

              // Subscribe to these variables
              if (isConnected) {
                subscribeToVariables(namespacedVars, namespace);
                console.log(
                  `Subscribed to ST variables with namespace ${namespace}:`,
                  namespacedVars
                );
              }

              setLoading(false);
              return;
            }
          }
        }

        // If we couldn't get variables from source code, use fallback variables
        console.log('Using fallback variables - no source code found');
        const fallbackVars = [
          `${namespace}.Mode`,
          `${namespace}.Sensor1`,
          `${namespace}.Sensor2`,
          `${namespace}.EmergencyVehicle`,
          `${namespace}.ManualOverride`,
          `${namespace}.TimeOfDay`,
        ];

        setAvailableVariables(fallbackVars);
        setSelectedVariables(fallbackVars.slice(0, 2)); // Just select the first two

        if (isConnected) {
          subscribeToVariables(fallbackVars, namespace);
          console.log(
            `Subscribed to fallback variables with namespace ${namespace}`
          );
        }
      } catch (error) {
        console.error('Error fetching ST code:', error);
        // Use basic fallback if everything fails
        const basicFallback = [`${namespace}.Mode`, `${namespace}.Sensor1`];
        setAvailableVariables(basicFallback);
        setSelectedVariables(basicFallback.slice(0, 1));

        if (isConnected) {
          subscribeToVariables(basicFallback, namespace);
        }
      }

      setLoading(false);
    };

    fetchSTCode();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.name]); // Only re-run if file name changes

  // Get the file name without path
  const getFileName = (filename: string) => {
    // Extract just the filename from the full path if necessary
    const cleanName = filename.replace('Trends: ', '');
    console.log('Clean file name:', cleanName);
    if (cleanName.includes('/')) {
      return cleanName.substring(cleanName.lastIndexOf('/') + 1);
    }
    return cleanName;
  };

  // Add a new variable manually
  const handleAddVariable = () => {
    if (!manualVariable.trim()) return;

    // Get the namespace from existing variables, or create one if none exist
    let namespace = 'main-st'; // Default to main-st

    if (availableVariables.length > 0 && availableVariables[0].includes('.')) {
      // Extract namespace from first available variable
      namespace = availableVariables[0].split('.')[0];
    } else if (
      file.name &&
      file.name !== 'unknown' &&
      !file.name.includes('Trends:')
    ) {
      // Try to get namespace from file name
      const fileName = getFileName(file.name);
      const baseName = fileName.replace('.st', '');
      namespace = `${baseName}-st`;
    }

    console.log(`Using namespace ${namespace} for manual variable`);

    // Format the variable with namespace if it doesn't already have one
    let formattedVariable = manualVariable;
    if (!manualVariable.includes('.')) {
      formattedVariable = `${namespace}.${manualVariable}`;
    }

    // Add to available variables if not already there
    if (!availableVariables.includes(formattedVariable)) {
      // Update all state in one batch to avoid multiple renders
      const newVariables = [...availableVariables, formattedVariable];
      setAvailableVariables(newVariables);
      setSelectedVariables((prev) => [...prev, formattedVariable]);

      // Subscribe to this variable
      if (isConnected) {
        // Subscribe to both the new variable and refresh all existing variables
        subscribeToVariables([...newVariables], namespace);
        console.log(`Subscribed to variables: ${newVariables.join(', ')}`);

        // Force a refresh after subscription
        setTimeout(handleRefresh, 500);
      }

      // Clear the input
      setManualVariable('');
    }
  };

  // Generate trend data from history data from WebSocket
  useEffect(() => {
    if (
      isConnected &&
      selectedVariables.length > 0 &&
      historyData?.length > 0
    ) {
      // Calculate the time range in milliseconds
      const rangeInMinutes =
        timeRange === '1m'
          ? 1
          : timeRange === '5m'
          ? 5
          : timeRange === '15m'
          ? 15
          : 60;

      const rangeMs = rangeInMinutes * 60 * 1000;
      const cutoffTime = new Date(Date.now() - rangeMs);

      // Filter history data based on time range
      const filteredHistory = historyData.filter(
        (point) => new Date(point.timestamp) > cutoffTime
      );

      // Format the data for the chart
      const formattedData = filteredHistory.map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const dataPoint: Record<string, any> = { time };

        selectedVariables.forEach((varName) => {
          // Check if this variable exists in the history entry
          if (entry[varName] !== undefined) {
            // Handle time duration strings (e.g. "1.499788s")
            let value = entry[varName];
            if (typeof value === 'string' && value.endsWith('s')) {
              // Remove the 's' suffix and convert to number
              value = parseFloat(value.slice(0, -1));
            }
            // Ensure the value is a number for the chart
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              dataPoint[varName] = numValue;
            } else {
              console.warn(
                `Failed to convert value for ${varName}: ${value} (${typeof value})`
              );
            }
          } else if (varName.includes('Timer.ET')) {
            // Special check for Timer.ET - look for it in any format
            const timerKeys = Object.keys(entry).filter((k) =>
              k.includes('Timer.ET')
            );
            if (timerKeys.length > 0) {
              let value = entry[timerKeys[0]];
              if (typeof value === 'string' && value.endsWith('s')) {
                value = parseFloat(value.slice(0, -1));
              }
              const numValue = Number(value);
              if (!isNaN(numValue)) {
                dataPoint[varName] = numValue;
              }
            }
          }
        });

        return dataPoint;
      });

      setTrendData(formattedData);
      setLoading(false);
    }
  }, [historyData, selectedVariables, timeRange]); // Only re-run if these change

  // When WebSocket variables update, check if any match our subscriptions
  useEffect(() => {
    if (
      wsVariables &&
      Object.keys(wsVariables).length > 0 &&
      availableVariables.length > 0
    ) {
      // Only log this initially or when something changes, and not too often
      const shouldLog = !hasAttemptedSubscribe || Math.random() < 0.01;

      if (shouldLog) {
        console.log('Checking for subscribed variables in WebSocket data');
      }

      let foundVars: string[] = [];

      // Check all variable paths
      Object.entries(wsVariables).forEach(([path, varGroup]: [string, any]) => {
        if (shouldLog) {
          console.log(`Checking path ${path} for subscribed variables`);
        }

        // Check if any variables in this path match our subscribed variables
        let foundInThisPath = 0;
        varGroup.forEach((v: any) => {
          if (
            typeof v.Name === 'string' &&
            availableVariables.includes(v.Name)
          ) {
            foundInThisPath++;
            foundVars.push(v.Name);
          }
        });

        // Log only the count of found variables instead of each one individually
        if (shouldLog && foundInThisPath > 0) {
          console.log(
            `Found ${foundInThisPath} subscribed variables in path ${path}`
          );
        }
      });

      // If we found new variables, update available variables
      if (foundVars.length > 0 && !hasAttemptedSubscribe) {
        if (shouldLog) {
          console.log(
            `Found ${foundVars.length} total subscribed variables in WebSocket data`
          );
        }
        setHasAttemptedSubscribe(true);
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsVariables]); // Only depend on wsVariables to avoid loops

  const handleVariableToggle = (variable: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable]
    );
  };

  // Function to manually refresh subscriptions
  const handleRefresh = () => {
    setLoading(true);

    if (isConnected && availableVariables.length > 0) {
      // Get the namespace from the first available variable if possible
      let namespace = 'main-st'; // Default namespace

      if (availableVariables[0].includes('.')) {
        namespace = availableVariables[0].split('.')[0];
      } else if (file.name && file.name !== 'unknown') {
        const fileName = getFileName(file.name.replace('Trends: ', ''));
        const baseName = fileName.replace('.st', '');
        namespace = `${baseName}-st`;
      }

      console.log(`Refreshing subscriptions with namespace: ${namespace}`);
      subscribeToVariables(availableVariables, namespace);
      console.log('Re-subscribed to variables:', availableVariables);
    }

    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
        <div className="flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-500" />
          <h2 className="text-lg font-medium">Trends: {file.name}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center text-sm">
            <Clock className="h-4 w-4 mr-1" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
            >
              <option value="1m">Last 1 minute</option>
              <option value="5m">Last 5 minutes</option>
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last hour</option>
            </select>
          </div>
          <div className="flex items-center">
            <Checkbox
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(checked as boolean)}
              id="autoRefresh"
              className="mr-2"
            />
            <Label htmlFor="autoRefresh" className="text-sm flex items-center">
              <RefreshCw className="h-3 w-3 mr-1" /> Auto-refresh
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 h-full">
        <div className="col-span-3 border-r dark:border-gray-700 p-4 overflow-y-auto">
          <div className="flex items-center mb-3">
            <Filter className="h-4 w-4 mr-2" />
            <h3 className="text-sm font-medium">Variables</h3>
          </div>

          {/* Add variable input */}
          <div className="flex mb-4">
            <input
              type="text"
              value={manualVariable}
              onChange={(e) => setManualVariable(e.target.value)}
              placeholder="Enter variable path"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-l"
              onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
            />
            <Button
              size="sm"
              className="rounded-l-none"
              onClick={handleAddVariable}
            >
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {availableVariables.map((variable: string) => (
              <div key={variable} className="flex items-center">
                <Checkbox
                  checked={selectedVariables.includes(variable)}
                  onCheckedChange={() => handleVariableToggle(variable)}
                  id={`var-${variable}`}
                  className="mr-2"
                />
                <Label htmlFor={`var-${variable}`} className="text-sm">
                  {variable}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-9 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Variable Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={trendData}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedVariables.map((variable, index) => (
                      <Line
                        key={variable}
                        type="monotone"
                        dataKey={variable}
                        stroke={COLORS[index % COLORS.length]}
                        activeDot={{ r: 8 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
