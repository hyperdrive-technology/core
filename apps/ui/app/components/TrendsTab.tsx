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
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CompilationResult, useIECCompiler } from '../hooks/useIECCompiler';
import { CONTROLLER_API } from '../utils/constants';
import { IECFile } from '../utils/iec-file-loader';
import { useWebSocket } from './context/WebSocketContext';
import { FileNode } from './types';

interface HistoryEntry {
  time: number;
  [variablePath: string]: number | string | undefined; // Allow string/number values
}

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

// Placeholder for the AST extraction function - NEEDS IMPLEMENTATION
const extractVariablesFromAST = (
  ast: any,
  currentNamespace: string
): string[] => {
  console.log('Processing AST structure for variable extraction');
  const variableSet = new Set<string>(); // Use a Set to avoid duplicates

  // Get the program declaration from the AST
  if (ast?.programs && ast.programs.length > 0) {
    // Use the first program in the programs array
    const pou = ast.programs[0];

    if (pou) {
      console.log(`Found POU: ${pou.name} in AST`);

      // Access the variable declarations
      const varDeclarations = pou.varDeclarations || [];
      console.log(
        `Found ${varDeclarations.length} variable declaration sections`
      );

      if (Array.isArray(varDeclarations)) {
        varDeclarations.forEach((varDecl: any, sectionIndex: number) => {
          if (varDecl.variables && Array.isArray(varDecl.variables)) {
            console.log(
              `Processing section ${sectionIndex} with ${varDecl.variables.length} variables`
            );

            varDecl.variables.forEach((variable: any) => {
              // In the AST, the structure is { name: { value: 'VariableName' } }
              const varName = variable.name?.value || variable.name;
              if (varName) {
                const fullPath = `${currentNamespace}.${varName}`;
                variableSet.add(fullPath); // Using Set to avoid duplicates
                console.log(`-> Found variable: ${fullPath}`);
              }
            });
          }
        });
      }
    }
  } else {
    console.log('No programs found in AST');
  }

  // Convert Set to Array
  const variables = Array.from(variableSet);

  console.log(
    `AST extraction for ${currentNamespace} returned ${variables.length} variables:`,
    variables
  );
  return variables;
};

const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
];

// Helper to format timestamp
const formatTimestamp = (timestamp: string | number | undefined): string => {
  if (!timestamp) return '-';
  try {
    const date =
      typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) return '-'; // Invalid date
    // Format as HH:MM:SS
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (e) {
    return '-';
  }
};

// Example Custom Tooltip (adjust based on actual needs)
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const time = formatTimestamp(label);
    return (
      <div className="bg-background border rounded-md p-2 shadow-lg text-sm">
        <p className="font-semibold mb-1">Time: {time}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function TrendsTab({ file }: TrendsTabProps) {
  // Add the IEC compiler hook
  const { compile, status: compileStatus } = useIECCompiler();

  const {
    isConnected,
    variables: wsVariables,
    historyData,
    subscribeToVariables,
    setTrendTabOpen,
    controllers,
  } = useWebSocket();
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>('Last 5m'); // Example
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualVariable, setManualVariable] = useState<string>('');
  const [hasAttemptedSubscribe, setHasAttemptedSubscribe] = useState(false);
  // State to track expanded structs
  const [expandedStructs, setExpandedStructs] = useState<Set<string>>(
    new Set()
  );
  // State to hold the latest relevant compilation result
  const [latestCompilationResult, setLatestCompilationResult] =
    useState<CompilationResult | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'waiting' | 'processing' | 'error' | 'success'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add a helper function to extract filename from path - MOVED UP before useMemo
  const extractFileName = (filename: string) => {
    // Extract just the filename from the full path if necessary
    const cleanName = filename.replace('Trends: ', '');
    console.log('Clean file name:', cleanName);
    if (cleanName.includes('/')) {
      return cleanName.substring(cleanName.lastIndexOf('/') + 1);
    }
    return cleanName;
  };

  // Derive namespace from file name
  const namespace = useMemo(() => {
    if (!file.name || file.name === 'unknown') return null;
    const cleanedName = extractFileName(file.name.replace('Trends: ', ''));
    return cleanedName ? `${cleanedName.replace('.st', '')}-st` : null;
  }, [file.name]);

  // Notify WebSocketContext when the trend tab is opened/closed
  useEffect(() => {
    setTrendTabOpen(true);
    return () => {
      setTrendTabOpen(false);
    };
  }, [setTrendTabOpen]);

  // Effect to reset state when the file changes
  useEffect(() => {
    setStatus('waiting'); // Start in waiting state for the new file
    setErrorMessage(null);
    setLatestCompilationResult(null);
    setAvailableVariables([]);
    setSelectedVariables([]);
    setTrendData([]);
    setExpandedStructs(new Set());
    console.log(
      `TrendsTab: Resetting state for new file/namespace: ${namespace}`
    );
  }, [namespace]); // Reset when namespace changes

  // Add effect to automatically compile the file when component mounts
  useEffect(() => {
    if (file.name && namespace) {
      console.log(`Auto-compiling file: ${file.name} for Trends tab`);

      const compileFile = async () => {
        let fileContent = file.content;

        // If content is not available, try to fetch it
        if (!fileContent && namespace) {
          try {
            console.log(
              `Fetching source code for ${namespace} before compilation`
            );
            const response = await fetch(
              CONTROLLER_API.DOWNLOAD_AST(namespace)
            );

            if (response.ok) {
              const data = await response.json();
              if (data.sourceCode) {
                fileContent = data.sourceCode;
                console.log(
                  `Successfully fetched source code for ${namespace}`
                );
              } else {
                console.warn(
                  `Source code not found in response for ${namespace}`
                );
                return; // Can't compile without content
              }
            } else {
              console.error(
                `Failed to fetch source code for ${namespace}. Status: ${response.status} ${response.statusText}`
              );
              return; // Can't compile without content
            }
          } catch (error) {
            console.error(
              'Error fetching file content for compilation:',
              error
            );
            return; // Can't compile without content
          }
        }

        if (fileContent) {
          // Create IECFile object for compilation
          const fileToCompile: IECFile = {
            fileName: file.name.replace('Trends: ', ''),
            content: fileContent,
          };

          // Trigger compilation
          compile([fileToCompile]);

          // The compilation result will be handled by the existing event listener
          // for 'iec-compilation-result' events
        } else {
          console.error(`Cannot compile ${file.name}: No content available`);
        }
      };

      compileFile();
    }
  }, [file.name, file.content, namespace, compile]);

  // Effect to listen for global compilation results
  useEffect(() => {
    if (!namespace) return; // Don't listen if we don't have a namespace

    const handleCompilationResult = (event: Event) => {
      const customEvent = event as CustomEvent<CompilationResult>;
      const resultData = customEvent.detail;

      console.log('Received iec-compilation-result event:', resultData);

      // Simplified: Store the received result directly. The processing effect will handle it.
      setLatestCompilationResult(resultData);

      // Basic check: Does the AST contain a program matching our derived name?
      /*
      let isRelevant = false;
      if (resultData.ast) {
        const programName = namespace.replace('-st', '');
        const programs = resultData.ast.programs || [];
        if (programs.some((p: any) => p.name === programName)) {
          isRelevant = true;
        }
        // NOTE: This relevance check might need to be more sophisticated
        // depending on the exact AST structure and how filenames/POUs relate.
      }

      if (isRelevant) {
        console.log(
          `Compilation result IS relevant to ${namespace}. Storing it.`
        );
        setLatestCompilationResult(resultData);
      } else {
        console.log(
          `Compilation result is NOT relevant to ${namespace}. Ignoring.`
        );
      }
      */
    };

    window.addEventListener('iec-compilation-result', handleCompilationResult);
    console.log(
      `TrendsTab for ${namespace} listening for compilation results.`
    );

    return () => {
      window.removeEventListener(
        'iec-compilation-result',
        handleCompilationResult
      );
      console.log(`TrendsTab for ${namespace} stopped listening.`);
    };
  }, [namespace]); // Re-attach listener if namespace changes

  // Effect to process the stored compilation result and extract variables
  useEffect(() => {
    if (!namespace) {
      setStatus('waiting'); // Cannot proceed without namespace
      setErrorMessage(null);
      return;
    }

    if (latestCompilationResult) {
      if (latestCompilationResult.success && latestCompilationResult.ast) {
        setStatus('processing');
        setErrorMessage(null);
        console.log(`Processing AST for ${namespace}...`);
        try {
          const extractedVars = extractVariablesFromAST(
            latestCompilationResult.ast,
            namespace
          );
          console.log(
            `Extracted ${extractedVars.length} vars for ${namespace}:`,
            extractedVars
          );

          if (extractedVars.length > 0) {
            setAvailableVariables(extractedVars);

            // Select ALL variables by default
            setSelectedVariables(extractedVars);

            if (isConnected) {
              console.log(
                `Subscribing to ${extractedVars.length} selected variables from AST for ${namespace}.`
              );
              subscribeToVariables(extractedVars, namespace);
              setHasAttemptedSubscribe(true);
            }

            setStatus('success');
          } else {
            console.log(`No variables extracted from AST for ${namespace}.`);
            setAvailableVariables([]);
            setSelectedVariables([]);
            setStatus('error');
            setErrorMessage(
              `No variables found in the compiled code. Check that the file contains variable declarations.`
            );
          }
        } catch (extractionError: any) {
          console.error(
            `Error extracting variables from AST for ${namespace}:`,
            extractionError
          );
          setAvailableVariables([]);
          setStatus('error');
          setErrorMessage(
            `Failed to extract variables from compiled code: ${extractionError.message}`
          );
        }
      } else if (!latestCompilationResult.success) {
        // Handle compilation failure
        setStatus('error');
        setErrorMessage(
          `Compilation failed for ${namespace}. Check compile output panel.`
        );
        setAvailableVariables([]);
        console.error(
          `Compilation failed for ${namespace}, diagnostics: `,
          latestCompilationResult.diagnostics
        );
      }
    } else if (status !== 'success' && status !== 'error') {
      // If no relevant result yet, remain in waiting state
      setStatus('waiting');
      setErrorMessage(null); // Clear previous error message if any
      setAvailableVariables([]); // Ensure vars are cleared
    }
  }, [
    latestCompilationResult,
    namespace,
    isConnected,
    subscribeToVariables,
    status,
  ]);

  // Helper to re-check relevance within the processing effect
  // (Reduces duplication from the event listener)
  // REMOVED - Relevance check simplified
  /*
  const isCompilationResultRelevant = (
    result: CompilationResult | null,
    currentNamespace: string | null
  ): boolean => {
    if (!result?.ast || !currentNamespace) return false;
    const programName = currentNamespace.replace('-st', '');
    const programs = result.ast.programs || [];
    return programs.some((p: any) => p.name === programName);
    // Add more sophisticated checks if needed
  };
  */

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
      const fileName = extractFileName(file.name);
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
        subscribeToVariables(newVariables, namespace);
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
    setSelectedVariables((prev) => {
      const newSelected = prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable];

      // Update subscriptions to match selected variables
      if (isConnected && namespace) {
        subscribeToVariables(newSelected, namespace);
        console.log(`Updated subscriptions to ${newSelected.length} variables`);
      }

      return newSelected;
    });
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
        const fileName = extractFileName(file.name.replace('Trends: ', ''));
        const baseName = fileName.replace('.st', '');
        namespace = `${baseName}-st`;
      }

      console.log(`Refreshing subscriptions with namespace: ${namespace}`);
      subscribeToVariables(availableVariables, namespace);
      console.log('Re-subscribed to variables:', availableVariables);
    }

    setTimeout(() => setLoading(false), 500);
  };

  // Updated getLatestValue function to ensure it's correctly retrieving values
  const getLatestValue = (variablePath: string): any => {
    // variablePath is like "namespace.VariableName" e.g., "main-st.Counter"
    const parts = variablePath.split('.');
    if (parts.length < 2) return 'N/A'; // Invalid format

    const namespace = parts[0];
    const varName = parts.slice(1).join('.'); // Handle variable names with dots

    // Look for this variable in the websocket variables
    for (const wsKey in wsVariables) {
      // wsKey format is "controllerId:filePath"
      if (wsKey.includes(`:${namespace}`)) {
        const variableArray = wsVariables[wsKey];
        // Look for exact match or match on just the variable name part
        const foundVar = variableArray?.find(
          (v) => v.Name === variablePath || v.Name === varName
        );

        if (foundVar) {
          return foundVar.Value !== undefined ? foundVar.Value : 'N/A';
        }
      }
    }

    // Also check history data for most recent value
    if (historyData && historyData.length > 0) {
      const latestEntry = historyData[historyData.length - 1];
      if (latestEntry && latestEntry[variablePath] !== undefined) {
        return latestEntry[variablePath];
      }
    }

    return 'N/A';
  };

  // Updated getLatestTimestamp function to ensure it's correctly retrieving timestamps
  const getLatestTimestamp = (variablePath: string): string | undefined => {
    // variablePath is like "namespace.VariableName" e.g., "main-st.Counter"
    const parts = variablePath.split('.');
    if (parts.length < 2) return undefined; // Invalid format

    const namespace = parts[0];
    const varName = parts.slice(1).join('.'); // Handle variable names with dots

    // Look for this variable in the websocket variables
    for (const wsKey in wsVariables) {
      // wsKey format is "controllerId:filePath"
      if (wsKey.includes(`:${namespace}`)) {
        const variableArray = wsVariables[wsKey];
        // Look for exact match or match on just the variable name part
        const foundVar = variableArray?.find(
          (v) => v.Name === variablePath || v.Name === varName
        );

        if (foundVar && foundVar.Timestamp) {
          return foundVar.Timestamp;
        }
      }
    }

    // Also check history data for most recent timestamp
    if (historyData && historyData.length > 0) {
      const latestEntry = historyData[historyData.length - 1];
      if (latestEntry && latestEntry.timestamp) {
        return latestEntry.timestamp as string;
      }
    }

    return undefined;
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
        const value = parseFloat(String(valueStr));
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

  // Helper to toggle struct expansion
  const toggleStructExpansion = (structPath: string) => {
    setExpandedStructs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(structPath)) {
        newSet.delete(structPath);
      } else {
        newSet.add(structPath);
      }
      return newSet;
    });
  };

  // Process availableVariables to identify top-level items and structs
  const tableItems = useMemo(() => {
    const topLevelPaths = new Set<string>();
    const structPaths = new Set<string>();
    const memberMap = new Map<string, string[]>(); // structPath -> memberPaths[]

    // First pass: identify potential structs and members
    availableVariables.forEach((path) => {
      const parts = path.split('.');
      if (parts.length > 2) {
        // Potential member like namespace.Struct.Member
        const potentialStructPath = parts.slice(0, -1).join('.');
        structPaths.add(potentialStructPath);
        if (!memberMap.has(potentialStructPath)) {
          memberMap.set(potentialStructPath, []);
        }
        memberMap.get(potentialStructPath)?.push(path);
      } else if (parts.length === 2) {
        // Potential top-level simple var or struct root like namespace.Variable
        topLevelPaths.add(path);
      }
    });

    // Second pass: Confirm top-level items
    // Remove items from topLevelPaths if they are actually members identified in pass 1
    memberMap.forEach((members) => {
      members.forEach((memberPath) => {
        topLevelPaths.delete(memberPath); // Ensure members aren't treated as top-level
      });
    });

    // Ensure struct roots identified via members are added to topLevelPaths
    structPaths.forEach((structPath) => {
      topLevelPaths.add(structPath);
    });

    // Sort top-level paths alphabetically
    const sortedTopLevel = Array.from(topLevelPaths).sort();

    return {
      sortedTopLevel,
      structPaths,
      memberMap,
    };
  }, [availableVariables]);

  // Add effect to monitor compile status changes
  useEffect(() => {
    if (compileStatus === 'compiling') {
      setStatus('waiting');
      setErrorMessage(null);
    }
  }, [compileStatus]);

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
        {status === 'waiting' ||
        status === 'processing' ||
        status === 'error' ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {status === 'waiting' &&
              (compileStatus === 'compiling'
                ? 'Compiling code...'
                : 'Analyzing variables...')}
            {status === 'processing' && 'Processing compiled code...'}
            {status === 'error' && `Error: ${errorMessage}`}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tickFormatter={formatTimestamp} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              {selectedVariables.map((variable, index) => (
                <Line
                  key={variable}
                  type="monotone"
                  dataKey={variable}
                  stroke={COLORS[index % COLORS.length]}
                  dot={false}
                  isAnimationActive={!autoRefresh}
                  name={variable.split('.').pop()}
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
              <TableHead>Name</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Last Timestamp</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Min</TableHead>
              <TableHead>Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === 'waiting' && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  {compileStatus === 'compiling'
                    ? 'Compiling code...'
                    : 'Analyzing variables...'}
                </TableCell>
              </TableRow>
            )}
            {status === 'processing' && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  Processing compiled code...
                </TableCell>
              </TableRow>
            )}
            {status === 'error' && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-red-500">
                  Error: {errorMessage || 'Failed to load variables.'}
                </TableCell>
              </TableRow>
            )}
            {status === 'success' && availableVariables.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  No variables found in the compiled code for '{file.name}'.
                </TableCell>
              </TableRow>
            )}
            {/* Only render variable rows if status is success and vars exist */}
            {status === 'success' &&
              availableVariables.length > 0 &&
              tableItems.sortedTopLevel.map((path) => {
                const isStruct = tableItems.structPaths.has(path);
                const isExpanded = expandedStructs.has(path);
                const members = tableItems.memberMap.get(path) || [];
                const variableName = path.split('.').pop() || path;

                const parentRow = (
                  <TableRow key={path}>
                    <TableCell className="w-[60px]">
                      {isStruct ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStructExpansion(path)}
                          className="px-1"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Checkbox
                          checked={selectedVariables.includes(path)}
                          onCheckedChange={() => handleVariableToggle(path)}
                          id={`select-${path}`}
                          aria-label={`Select ${variableName}`}
                        />
                      )}
                    </TableCell>
                    <TableCell>{variableName}</TableCell>
                    <TableCell className="font-mono text-xs">{path}</TableCell>
                    <TableCell>
                      {formatTimestamp(getLatestTimestamp(path))}
                    </TableCell>
                    <TableCell>
                      {String(getLatestValue(path) ?? 'N/A')}
                    </TableCell>
                    <TableCell>{String(getMinMax(path).min)}</TableCell>
                    <TableCell>{String(getMinMax(path).max)}</TableCell>
                  </TableRow>
                );

                const memberRows =
                  isStruct && isExpanded
                    ? members.sort().map((memberPath) => {
                        const memberName =
                          memberPath.split('.').pop() || memberPath;
                        const isMemberSelected =
                          selectedVariables.includes(memberPath);
                        const memberValue = getLatestValue(memberPath);
                        const memberTimestamp = getLatestTimestamp(memberPath);
                        const { min: memberMin, max: memberMax } =
                          getMinMax(memberPath);

                        return (
                          <TableRow key={memberPath}>
                            <TableCell className="pl-8 w-[60px]">
                              <Checkbox
                                checked={isMemberSelected}
                                onCheckedChange={() =>
                                  handleVariableToggle(memberPath)
                                }
                                id={`select-${memberPath}`}
                                aria-label={`Select ${memberName}`}
                              />
                            </TableCell>
                            <TableCell className="pl-8">{memberName}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {memberPath}
                            </TableCell>
                            <TableCell>
                              {formatTimestamp(memberTimestamp)}
                            </TableCell>
                            <TableCell>
                              {String(memberValue ?? 'N/A')}
                            </TableCell>
                            <TableCell>{String(memberMin)}</TableCell>
                            <TableCell>{String(memberMax)}</TableCell>
                          </TableRow>
                        );
                      })
                    : null;

                return (
                  <Fragment key={path}>
                    {parentRow}
                    {memberRows}
                  </Fragment>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
