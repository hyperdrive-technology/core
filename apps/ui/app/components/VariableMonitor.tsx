import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

interface VariableMonitorProps {
  className?: string;
}

const VariableMonitor = ({ className }: VariableMonitorProps) => {
  const [variables, setVariables] = useState<VariableMap>({});
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:3000/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established');
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
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Function to render the data type name
  const getDataTypeName = (type: number): string => {
    switch (type) {
      case 0:
        return 'Bool';
      case 1:
        return 'Int';
      case 2:
        return 'Float';
      case 3:
        return 'String';
      default:
        return 'Unknown';
    }
  };

  // Function to render the quality status
  const getQualityName = (quality: number): string => {
    switch (quality) {
      case 0:
        return 'Good';
      case 1:
        return 'Bad';
      case 2:
        return 'Uncertain';
      default:
        return 'Unknown';
    }
  };

  // Format the scan time for display
  const formatScanTime = (scanTime: number | undefined): string => {
    if (!scanTime) return 'N/A';
    return `${scanTime / 1000000}ms`; // Convert nanoseconds to milliseconds
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Runtime Monitor</CardTitle>
        {status && (
          <div className="text-sm text-muted-foreground">
            Scan time: {formatScanTime(status.scanTime)} | Status:{' '}
            {status.status}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="variables">
          <TabsList className="mb-4">
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
          </TabsList>

          <TabsContent value="variables">
            <div className="max-h-[400px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quality
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(variables).map(([path, vars]) =>
                    vars.map((variable, index) => (
                      <tr
                        key={`${path}-${variable.Name}-${index}`}
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (typeof variable.Value === 'number') {
                            setSelectedVariable(variable.Name);
                          }
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {path}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {variable.Name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getDataTypeName(variable.DataType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {variable.Value?.toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getQualityName(variable.Quality)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(variable.Timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="graph">
            <div className="h-[400px]">
              {historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tick={false}
                      label={{
                        value: 'Time',
                        position: 'insideBottomRight',
                        offset: 0,
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(label: string) =>
                        new Date(label).toLocaleTimeString()
                      }
                    />
                    {Object.keys(historyData[0] || {})
                      .filter(
                        (key) =>
                          key !== 'timestamp' &&
                          (!selectedVariable || key === selectedVariable),
                      )
                      .map((key, index) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={`hsl(${index * 30}, 70%, 50%)`}
                          name={key}
                          dot={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  No data available for graphing
                </div>
              )}
            </div>
            {selectedVariable && (
              <div className="mt-2 text-center">
                <button
                  className="text-sm text-blue-500 hover:underline"
                  onClick={() => setSelectedVariable(null)}
                >
                  Show all variables
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default VariableMonitor;
