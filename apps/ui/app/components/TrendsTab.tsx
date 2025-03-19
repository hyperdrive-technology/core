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
import { useWebSocket } from './context/WebSocketContext';
import { FileNode } from './types';

interface TrendsTabProps {
  file: FileNode;
}

const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#0088fe',
  '#00C49F',
];

export default function TrendsTab({ file }: TrendsTabProps) {
  const { isConnected, variables: wsVariables } = useWebSocket();
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get available variables from WebSocket when the component mounts
  useEffect(() => {
    // Use data from WebSocket variables if available
    if (wsVariables && Object.keys(wsVariables).length > 0) {
      // Extract variable names from the WebSocket context
      const varNames: string[] = [];
      Object.values(wsVariables).forEach((varGroup: any) => {
        varGroup.forEach((v: any) => {
          if (typeof v.Name === 'string') {
            varNames.push(v.Name);
          }
        });
      });

      setAvailableVariables(varNames);

      // Select the first few variables by default if none selected
      if (selectedVariables.length === 0 && varNames.length > 0) {
        setSelectedVariables(varNames.slice(0, 3));
      }

      setLoading(false);
    }
  }, [wsVariables, selectedVariables.length]);

  // Generate trend data based on history data from WebSocket
  useEffect(() => {
    if (isConnected && selectedVariables.length > 0 && wsVariables) {
      // Generate trend data from the history data
      // This would typically come from a WebSocket message in a real implementation
      const demoData = Array.from({ length: 20 }, (_, i) => {
        const timestamp = new Date(Date.now() - (19 - i) * 60000);
        const entry: Record<string, any> = {
          time: timestamp.toLocaleTimeString(),
        };

        selectedVariables.forEach((varName) => {
          // Get a somewhat stable value for this variable
          const baseValue = 50 + selectedVariables.indexOf(varName) * 20;
          const variation = Math.sin(i / 3) * 10 + Math.random() * 5;
          entry[varName] = Number((baseValue + variation).toFixed(1));
        });

        return entry;
      });

      setTrendData(demoData);
      setLoading(false);
    }
  }, [isConnected, selectedVariables, wsVariables]);

  const handleVariableToggle = (variable: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable]
    );
  };

  // Generate demo data if no websocket or real data available
  useEffect(() => {
    if (!isConnected || !selectedVariables.length) {
      // Create some dummy data for preview
      const demoData = Array.from({ length: 20 }, (_, i) => {
        const timestamp = new Date(Date.now() - (19 - i) * 60000);
        const entry: Record<string, any> = {
          time: timestamp.toLocaleTimeString(),
        };

        ['Temperature', 'Pressure', 'Flow', 'Level', 'Speed'].forEach(
          (variable, index) => {
            if (index < 3) {
              // Create somewhat realistic looking trend data with minor variations
              const baseValue = 50 + index * 20;
              const variation = Math.sin(i / 3) * 10 + Math.random() * 5;
              entry[variable] = Number((baseValue + variation).toFixed(1));
            }
          }
        );

        return entry;
      });

      setTrendData(demoData);
      setAvailableVariables([
        'Temperature',
        'Pressure',
        'Flow',
        'Level',
        'Speed',
      ]);
      if (selectedVariables.length === 0) {
        setSelectedVariables(['Temperature', 'Pressure', 'Flow']);
      }
      setLoading(false);
    }
  }, [isConnected, selectedVariables.length]);

  // Function to manually refresh data
  const handleRefresh = () => {
    setLoading(true);
    // In a real implementation, this would send a WebSocket message
    // For now, we'll just simulate a refresh delay
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
