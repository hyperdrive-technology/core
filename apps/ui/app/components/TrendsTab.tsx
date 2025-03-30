import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CartesianGrid,
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

    // CRITICAL: Reset lastIndex for the inner regex before each use
    varDeclRegex.lastIndex = 0;

    while ((varDecl = varDeclRegex.exec(sectionContent)) !== null) {
      if (varDecl[1] && !variables.includes(varDecl[1])) {
        variables.push(varDecl[1]);
      }
    }
  }

  // Comment out standalone variable check - less common in ST
  /*
  const globalVarRegex =
    /\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(?::=.*?)?;/g;
  let globalVar;
  while ((globalVar = globalVarRegex.exec(code)) !== null) {
    if (globalVar[1] && !variables.includes(globalVar[1])) {
      variables.push(globalVar[1]);
    }
  }
  */

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

// Helper to format timestamp
const formatTimestamp = (timestamp: number | string | undefined) => {
  if (!timestamp) return 'N/A';
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return 'Invalid Date';
  }
};

// Type for historical data entries (assuming structure)
interface HistoryEntry {
  time: number | string; // Allow string initially from data
  [variablePath: string]: any; // Variable values keyed by path
}

export default function TrendsTab({ file }: TrendsTabProps) {
  const {
    isConnected,
    variables: wsVariables, // This is VariableMap: { [path: string]: Variable[] }
    historyData, // This is any[], assumed to be HistoryEntry[]
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

  // Initialize with variables based on file name
  useEffect(() => {
    setLoading(true);
    const fileName = getFileName(file.name);
    let namespace = 'main-st';
    if (fileName && fileName !== 'unknown' && fileName !== 'trends') {
      const baseName = fileName.replace('.st', '').replace('Trends: ', '');
      namespace = `${baseName}-st`;
    }

    const fetchSTCode = async () => {
      let success = false; // Flag to track if we successfully set vars
      try {
        const response = await fetch(CONTROLLER_API.DOWNLOAD_AST(namespace));

        if (response.ok) {
          const data = await response.json();
          if (data.sourceCode) {
            const extractedVars = extractVariablesFromST(data.sourceCode);

            const namespacedVars = extractedVars.map(
              (v) => `${namespace}.${v}`
            );

            if (namespacedVars.length > 0) {
              setAvailableVariables(namespacedVars);
              setSelectedVariables(
                namespacedVars.slice(0, Math.min(4, namespacedVars.length))
              );
              if (isConnected) {
                subscribeToVariables(namespacedVars, namespace);
              }
              success = true; // Mark success
            }
          }
        }
      } catch (error) {
        console.error('TRENDS_INIT: Error during fetch/extraction:', error);
      }

      // Fallback logic ONLY if extraction failed
      if (!success) {
        const fallbackVars = [
          `${namespace}.Mode`,
          `${namespace}.Sensor1`,
          `${namespace}.Sensor2`,
          `${namespace}.EmergencyVehicle`,
          `${namespace}.ManualOverride`,
          `${namespace}.TimeOfDay`,
        ];
        setAvailableVariables(fallbackVars);
        setSelectedVariables(fallbackVars.slice(0, 2));
        if (isConnected) {
          subscribeToVariables(fallbackVars, namespace);
        }
      }

      setLoading(false);
    };

    fetchSTCode();
  }, [file.name, isConnected, subscribeToVariables]);

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

  // Generate trend data from history - REMOVE DEBUG LOGS
  useEffect(() => {
    if (
      isConnected &&
      selectedVariables.length > 0 &&
      historyData?.length > 0
    ) {
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
      const filteredHistory = historyData.filter(
        (point: any) =>
          point.timestamp && new Date(point.timestamp) > cutoffTime
      );
      const formattedData = filteredHistory.map((entry: HistoryEntry) => {
        const time = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
        const dataPoint: Record<string, any> = { time };
        selectedVariables.forEach((varName) => {
          if (entry[varName] !== undefined) {
            let value = entry[varName];
            if (typeof value === 'string' && value.endsWith('s')) {
              value = parseFloat(value.slice(0, -1));
            }
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              dataPoint[varName] = numValue;
            }
          } else if (varName.includes('Timer.ET')) {
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
      // Only set loading to false if we actually generated data
      if (formattedData.length > 0) {
        setLoading(false);
      }
    } else {
      setTrendData([]);
    }
  }, [historyData, selectedVariables, timeRange, isConnected]);

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

  // Helper to find the actual key in wsVariables matching the simple path suffix
  const findWsVariableKey = (simplePath: string): string | undefined => {
    const targetSuffix = `:${simplePath}`;
    const foundKey = Object.keys(wsVariables).find((key) =>
      key.includes(targetSuffix)
    );
    return foundKey;
  };

  // Function to get latest value for a variable
  const getLatestValue = (variablePath: string): any => {
    const actualKey = findWsVariableKey(variablePath);
    const latestUpdateArray = actualKey ? wsVariables[actualKey] : undefined;
    const value = latestUpdateArray?.[0]?.Value ?? 'N/A';
    return value;
  };

  // Function to get latest timestamp for a variable
  const getLatestTimestamp = (variablePath: string): string | undefined => {
    const actualKey = findWsVariableKey(variablePath);
    const latestUpdateArray = actualKey ? wsVariables[actualKey] : undefined;
    const timestamp = latestUpdateArray?.[0]?.Timestamp;
    return timestamp;
  };

  // Function to calculate Min/Max from history
  const getMinMax = (
    variablePath: string
  ): { min: number | string; max: number | string } => {
    const typedHistoryData = historyData as HistoryEntry[];
    if (!typedHistoryData || typedHistoryData.length === 0) {
      return { min: 'N/A', max: 'N/A' };
    }
    let min = Infinity;
    let max = -Infinity;
    let hasNumeric = false;
    typedHistoryData.forEach((entry: HistoryEntry) => {
      const valueStr = entry[variablePath];
      if (valueStr !== undefined && valueStr !== null) {
        const value = parseFloat(valueStr);
        if (!isNaN(value)) {
          hasNumeric = true;
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }
    });
    const result = hasNumeric ? { min, max } : { min: 'N/A', max: 'N/A' };
    return result;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-115px)] p-4 space-y-4">
      {/* Top Section: Controls - Keep this or integrate elsewhere if needed */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Trends: {file.name}</h2>
        <div className="flex items-center space-x-2">
          {/* Time Range Selector - Example */}
          <Button variant="outline" size="sm">
            Time: {timeRange}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || autoRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="autoRefresh"
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(!!checked)}
            />
            <Label htmlFor="autoRefresh">Auto-refresh</Label>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex-1 w-full h-[60%] min-h-[400px]">
        {' '}
        {/* Adjust height as needed */}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            Loading chart data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tickFormatter={formatTimestamp} />
              <YAxis />
              <Tooltip />
              {selectedVariables.map((variable, index) => (
                <Line
                  key={variable}
                  type="monotone"
                  dataKey={variable}
                  stroke={COLORS[index % COLORS.length]}
                  dot={false}
                  isAnimationActive={!autoRefresh}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Variables Table Section */}
      <div className="w-full overflow-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Select</TableHead>
              <TableHead className="w-[40px]">Color</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Last Timestamp</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Min</TableHead>
              <TableHead>Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {availableVariables.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  No variables available or detected.
                </TableCell>
              </TableRow>
            )}
            {availableVariables.map((variablePath) => {
              const { min, max } = getMinMax(variablePath);
              const variableName =
                variablePath.split('.').pop() || variablePath;
              const isSelected = selectedVariables.includes(variablePath);
              const latestValue = getLatestValue(variablePath);
              const latestTimestamp = getLatestTimestamp(variablePath);

              // Find color if selected
              const selectedIndex = selectedVariables.indexOf(variablePath);
              const color = isSelected
                ? COLORS[selectedIndex % COLORS.length]
                : undefined;

              return (
                <TableRow key={variablePath}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleVariableToggle(variablePath)}
                      id={`select-${variablePath}`}
                    />
                  </TableCell>
                  <TableCell>
                    {color && (
                      <div
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: color }}
                        title={`Color: ${color}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>{variableName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {variablePath}
                  </TableCell>
                  <TableCell>{formatTimestamp(latestTimestamp)}</TableCell>
                  <TableCell>{latestValue}</TableCell>
                  <TableCell>{min}</TableCell>
                  <TableCell>{max}</TableCell>
                </TableRow>
              );
            })}
            {/* Optional: Add row for manually adding variables */}
            {/* <TableRow>
              <TableCell colSpan={6}>
                <Input
                  placeholder="Enter variable path (e.g., main-st.MyVar)"
                  value={manualVariable}
                  onChange={(e) => setManualVariable(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={handleAddVariable} disabled={!manualVariable.trim()}>
                  Add
                </Button>
              </TableCell>
            </TableRow> */}
          </TableBody>
        </Table>
      </div>

      {/* Remove the old Card-based variable selection if it existed */}
    </div>
  );
}
