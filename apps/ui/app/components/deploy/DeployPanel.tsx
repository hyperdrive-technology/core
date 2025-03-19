import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Code, Loader2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

interface DeployPanelProps {
  projectPath: string;
}

export const DeployPanel: React.FC<DeployPanelProps> = ({ projectPath }) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compilationResult, setCompilationResult] = useState<{
    success: boolean;
  } | null>(null);
  const { isConnected } = useWebSocket();
  const [stFilesCount, setStFilesCount] = useState(0);

  // Check if the project path is an ST file and count all ST files
  useEffect(() => {
    // Count all ST files in the project - this is a simplified version
    // In a real implementation, you would scan the project directory
    fetch('http://localhost:3000/api/st-files-count', {
      method: 'GET',
    })
      .then((response) => response.json())
      .then((data) => {
        setStFilesCount(data.count || 0);
      })
      .catch((error) => {
        console.error('Error fetching ST files count:', error);
        // Fallback to assuming there are files to compile
        setStFilesCount(1);
      });
  }, [projectPath]);

  const handleCompile = async () => {
    try {
      setIsCompiling(true);
      setCompileError(null);
      setCompilationResult(null);

      // Use the single API endpoint for compilation
      const response = await fetch('http://localhost:3000/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath: projectPath,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Compilation failed');
      }

      setCompilationResult({ success: true });
      setStFilesCount(result.fileCount || stFilesCount);
    } catch (error) {
      setCompileError(
        error instanceof Error ? error.message : 'Compilation failed'
      );
      setCompilationResult({ success: false });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = async () => {
    // If we haven't compiled successfully, compile first
    if (!compilationResult?.success) {
      try {
        setIsCompiling(true);
        setCompileError(null);

        const compileResponse = await fetch(
          'http://localhost:3000/api/compile',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectPath: projectPath,
            }),
          }
        );

        const compileResult = await compileResponse.json();

        if (!compileResponse.ok) {
          throw new Error(compileResult.error || 'Compilation failed');
        }

        setCompilationResult({ success: true });
        setStFilesCount(compileResult.fileCount || stFilesCount);
      } catch (error) {
        setCompileError(
          error instanceof Error ? error.message : 'Compilation failed'
        );
        setCompilationResult({ success: false });
        return; // Don't proceed with deployment if compilation fails
      } finally {
        setIsCompiling(false);
      }
    }

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

        {stFilesCount === 0 && (
          <Alert>
            <AlertTitle>No IEC-61131 Files Found</AlertTitle>
            <AlertDescription>
              No IEC-61131 (.st) files found in the Control section
            </AlertDescription>
          </Alert>
        )}

        {compileError && (
          <Alert variant="destructive">
            <AlertTitle>Compilation Error</AlertTitle>
            <AlertDescription>{compileError}</AlertDescription>
          </Alert>
        )}

        {deployError && (
          <Alert variant="destructive">
            <AlertTitle>Deployment Error</AlertTitle>
            <AlertDescription>{deployError}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleCompile}
          disabled={isCompiling || stFilesCount === 0}
          className="w-full mb-2"
          title={
            stFilesCount === 0
              ? 'No IEC-61131 (.st) files to compile'
              : `Compile all IEC-61131 files (${stFilesCount} files found)`
          }
        >
          {isCompiling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Compiling...
            </>
          ) : (
            <>
              <Code className="mr-2 h-4 w-4" />
              Compile All Files
            </>
          )}
        </Button>

        <Button
          onClick={handleDeploy}
          disabled={
            !isConnected || isDeploying || isCompiling || stFilesCount === 0
          }
          className="w-full"
          title={
            stFilesCount === 0
              ? 'No IEC-61131 (.st) files to deploy'
              : 'Deploy all compiled files'
          }
        >
          {isDeploying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Deploy Project
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
