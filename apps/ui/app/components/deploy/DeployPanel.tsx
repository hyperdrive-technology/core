import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

interface DeployPanelProps {
  projectPath: string;
}

export const DeployPanel: React.FC<DeployPanelProps> = ({ projectPath }) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { isConnected } = useWebSocket();

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      setDeployError(null);

      const response = await fetch('http://localhost:3000/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: projectPath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Deployment failed');
      }

      // Success notification will be handled by WebSocket updates
    } catch (error) {
      setDeployError(
        error instanceof Error ? error.message : 'Deployment failed'
      );
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Deploy Project</h3>
          <div className="flex items-center space-x-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {deployError && (
          <Alert variant="destructive">
            <AlertTitle>Deployment Error</AlertTitle>
            <AlertDescription>{deployError}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleDeploy}
          disabled={!isConnected || isDeploying}
          className="w-full"
        >
          {isDeploying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deploying...
            </>
          ) : (
            'Deploy Project'
          )}
        </Button>
      </div>
    </Card>
  );
};
