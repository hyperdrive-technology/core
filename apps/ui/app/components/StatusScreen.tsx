import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock, Info, Server, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HYPERDRIVE_PORT, useWebSocket } from './context/WebSocketContext';
import { FileNode } from './types';

interface StatusScreenProps {
  file: FileNode;
}

export default function StatusScreen({ file }: StatusScreenProps) {
  const { status, controllers } = useWebSocket();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update the clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Find the controller in our list
  const controller = controllers.find((c) => c.id === file.id);
  const isControllerConnected = controller?.isConnected || false;

  if (!controller) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="mr-2 h-5 w-5" />
              Controller Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>The controller information could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Server className="mr-2 h-6 w-6" />
          Controller Status: {file.name}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Info className="mr-2 h-5 w-5" />
                Controller Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{file.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="flex items-center">
                    {isControllerConnected ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                        Connected
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                        Disconnected
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">IP Address:</span>
                  <span className="flex items-center">
                    <Wifi className="mr-2 h-4 w-4" />
                    {controller.ip}:{HYPERDRIVE_PORT}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Connection Type:</span>
                  <span>WebSocket</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Time Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium">Local Time:</span>
                  <span>{currentTime.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Local Date:</span>
                  <span>{currentTime.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Controller Time:</span>
                  <span>
                    {status
                      ? new Date(status.lastScan).toLocaleTimeString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Uptime:</span>
                  <span>{isControllerConnected ? '00:12:34' : 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Runtime Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Scan Time
                </div>
                <div className="text-2xl font-bold mt-1">
                  {status ? status.scanTime.toFixed(2) : 'N/A'} ms
                </div>
              </div>
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Variables
                </div>
                <div className="text-2xl font-bold mt-1">
                  {status ? status.variableCount : 'N/A'}
                </div>
              </div>
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Tasks
                </div>
                <div className="text-2xl font-bold mt-1">
                  {status ? status.taskCount : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Status Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg font-mono text-sm h-32 overflow-y-auto">
              <div className="text-green-600 dark:text-green-400">
                [INFO] {currentTime.toLocaleTimeString()} - Controller status:{' '}
                {status?.status || 'N/A'}
              </div>
              {status && (
                <div className="text-blue-600 dark:text-blue-400">
                  [INFO] {currentTime.toLocaleTimeString()} - Last scan:{' '}
                  {new Date(status.lastScan).toLocaleTimeString()}
                </div>
              )}
              <div className="text-gray-600 dark:text-gray-400">
                [INFO] {currentTime.toLocaleTimeString()} - WebSocket connection
                established
              </div>
              <div className="text-yellow-600 dark:text-yellow-400">
                [WARN]{' '}
                {new Date(currentTime.getTime() - 120000).toLocaleTimeString()}{' '}
                - Memory usage approaching threshold
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
