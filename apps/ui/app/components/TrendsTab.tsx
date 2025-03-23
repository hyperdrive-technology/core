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
import { toast } from 'sonner';
import { CONTROLLER_API, CONTROLLER_API_BASE_URL } from '../utils/constants';
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
  } = useWebSocket();
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [hasAttemptedSubscribe, setHasAttemptedSubscribe] = useState(false);

  // Fetch the source code for the file to extract variables
  useEffect(() => {
    const fetchAndProcessAST = async () => {
      console.log('TrendsTab for file:', file);
      console.log('File ID:', file.id);
      console.log('File name:', file.name);

      // Extract the original file ID
      const originalFileId = getOriginalFilePath(file.id);
      const fileName = getFileName(file.name);

      console.log('Using ID for download:', originalFileId);
      console.log('Using name for display:', fileName);

      // First check what ASTs are available
      try {
        const response = await fetch(
          `${CONTROLLER_API_BASE_URL}/api/download-ast`
        );
        if (response.ok) {
          const data = await response.json();
          console.log('Available ASTs:', data.keys);

          if (data.keys && data.keys.length > 0) {
            // Try to find a close match to our file
            let bestMatch = findBestASTMatch(data.keys, originalFileId);

            if (bestMatch) {
              console.log(`Found matching AST: ${bestMatch}`);
              // Now fetch this specific AST
              const { sourceCode, ast } = await fetchFileContent(bestMatch);

              if (ast) {
                processASTandVariables(ast, sourceCode, fileName);
                setLoading(false);
                return;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error checking available ASTs:', error);
      }

      // If we couldn't find a match from the list or the list endpoint failed,
      // fall back to direct request with the original ID
      const { sourceCode, ast } = await fetchFileContent(originalFileId);

      if (ast) {
        processASTandVariables(ast, sourceCode, fileName);
      } else {
        console.warn('Failed to retrieve AST, using fallback method');
        // Create a default message to display when the file isn't deployed
        setAvailableVariables([
          'Please deploy your file first to see variables',
        ]);
        // Show a notification to the user
        toast(
          'This file needs to be deployed before variables can be displayed',
          {
            duration: 5000,
          }
        );
      }

      setLoading(false);
    };

    fetchAndProcessAST();
  }, [file.id, file.name, isConnected]);

  // Find the best matching AST from available keys
  const findBestASTMatch = (
    keys: string[],
    targetPath: string
  ): string | null => {
    // Try exact match first
    if (keys.includes(targetPath)) {
      return targetPath;
    }

    // Try with/without .st extension
    const withExt = targetPath.endsWith('.st')
      ? targetPath
      : `${targetPath}.st`;
    const withoutExt = targetPath.endsWith('.st')
      ? targetPath.slice(0, -3)
      : targetPath;

    if (keys.includes(withExt)) return withExt;
    if (keys.includes(withoutExt)) return withoutExt;

    // Get just the filename
    const fileName = targetPath.includes('/')
      ? targetPath.substring(targetPath.lastIndexOf('/') + 1)
      : targetPath;

    // Try filename match
    for (const key of keys) {
      if (key.endsWith(fileName)) return key;
    }

    // If we have any main.st, use that as last resort
    for (const key of keys) {
      if (key.includes('main.st')) return key;
    }

    // Return the first AST if we couldn't find anything else
    return keys.length > 0 ? keys[0] : null;
  };

  // Process AST and extract variables
  const processASTandVariables = (
    ast: any,
    sourceCode: string | null,
    fileName: string
  ) => {
    // Extract variables from the AST
    const extractedVars = extractVariablesFromAST(ast);
    console.log('Variables extracted from AST:', extractedVars);

    if (extractedVars.length > 0) {
      setAvailableVariables(extractedVars);
      // Select the first few variables by default
      setSelectedVariables(
        extractedVars.slice(0, Math.min(4, extractedVars.length))
      );

      // Subscribe to these variables if connected
      if (isConnected) {
        subscribeToVariables(extractedVars, fileName);
        console.log('Subscribed to variables from AST for file:', fileName);
      }
    } else if (sourceCode) {
      // Fallback to extracting from source code if AST parsing failed
      const sourceVars = extractVariablesFromST(sourceCode);
      console.log('Variables extracted from source code:', sourceVars);

      setAvailableVariables(sourceVars);
      setSelectedVariables(sourceVars.slice(0, Math.min(4, sourceVars.length)));

      if (isConnected) {
        subscribeToVariables(sourceVars, fileName);
        console.log(
          'Subscribed to variables from source code for file:',
          fileName
        );
      }
    } else {
      console.warn('No variables found in AST or source code');
      setAvailableVariables(['No variables found']);
    }
  };

  // Get the file path or name from the trends node id
  const getOriginalFilePath = (fileId: string) => {
    // For trends nodes, the id format is "trends-{originalFileId}"
    let originalFileId = fileId.replace('trends-', '');

    // Strip any additional identifiers that might be present
    if (originalFileId.endsWith('-0')) {
      originalFileId = originalFileId.slice(0, -2);
    }

    // Get just the filename if it's a compound path
    if (originalFileId.includes('-')) {
      const parts = originalFileId.split('-');
      if (parts.length > 0) {
        // Try to get the last part that looks like a filename
        for (let i = parts.length - 1; i >= 0; i--) {
          if (parts[i].endsWith('.st')) {
            originalFileId = parts[i];
            break;
          }
        }
      }
    }

    console.log('Processed file ID:', originalFileId);
    return originalFileId;
  };

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

      // Debug log the history and numeric values only occasionally
      const shouldLog = Math.random() < 0.05; // Only log 5% of the time

      if (shouldLog) {
        console.log(
          `Processing ${filteredHistory.length} history points for ${selectedVariables.length} variables`
        );

        if (filteredHistory.length > 0) {
          const lastPoint = filteredHistory[filteredHistory.length - 1];
          console.log('Last history point:', lastPoint);
          // Only log a sample of variables instead of all
          const sampleVars = selectedVariables.slice(0, 2);
          sampleVars.forEach((varName) => {
            console.log(
              `Variable ${varName} value: ${
                lastPoint[varName]
              }, type: ${typeof lastPoint[varName]}`
            );
          });
          if (selectedVariables.length > 2) {
            console.log(
              `... and ${selectedVariables.length - 2} more variables`
            );
          }
        }
      }

      // Format the data for the chart
      const formattedData = filteredHistory.map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const dataPoint: Record<string, any> = { time };

        selectedVariables.forEach((varName) => {
          // Check if this variable exists in the history entry
          if (entry[varName] !== undefined) {
            // Ensure the value is a number for the chart
            const numValue = Number(entry[varName]);
            if (!isNaN(numValue)) {
              dataPoint[varName] = numValue;
            }
          }
        });

        return dataPoint;
      });

      // Only log chart data updates occasionally
      if (shouldLog) {
        console.log(`Chart data updated with ${formattedData.length} points`);
      }

      setTrendData(formattedData);
      setLoading(false);
    }
  }, [isConnected, selectedVariables, historyData, timeRange]);

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
      if (foundVars.length > 0) {
        if (shouldLog) {
          console.log(
            `Found ${foundVars.length} total subscribed variables in WebSocket data`
          );
        }
        if (!hasAttemptedSubscribe) {
          setHasAttemptedSubscribe(true);
        }
        setLoading(false);
      }
    }
  }, [wsVariables, availableVariables, hasAttemptedSubscribe]);

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

    if (sourceCode && isConnected) {
      // Re-extract variables and subscribe again
      const extractedVars = extractVariablesFromST(sourceCode);

      if (extractedVars.length > 0) {
        const fileName = getFileName(file.name.replace('Trends: ', ''));
        subscribeToVariables(extractedVars, fileName);
        console.log('Re-subscribed to variables:', extractedVars);
      }
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
