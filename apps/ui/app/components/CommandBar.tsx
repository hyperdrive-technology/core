import { Button } from '@/components/ui/button';
import { Code, Plug, Power, Upload } from 'lucide-react';
import { useWebSocket } from './context/WebSocketContext';

export interface CommandBarProps {
  projectName: string;
  onDeploy: () => void;
  onCompile: () => void;
  hasUnsavedChanges: boolean;
  isDeploying?: boolean;
  isCompiling?: boolean;
  isCompileDisabled?: boolean;
  isDeployDisabled?: boolean;
}

export const CommandBar = ({
  projectName,
  onDeploy,
  onCompile,
  hasUnsavedChanges,
  isDeploying,
  isCompiling,
  isCompileDisabled,
  isDeployDisabled,
}: CommandBarProps) => {
  const { isConnected, connect, disconnect, controllers } = useWebSocket();

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect(); // Disconnect from all controllers
    } else {
      connect(); // Connect to all controllers
    }
  };

  const connectedCount = controllers.filter((c) => c.isConnected).length;
  const totalControllers = controllers.length;

  return (
    <div className="flex items-center justify-between p-2 border-b dark:border-gray-700  dark:bg-gray-900">
      <div />
      {/* Center - Project name */}
      <div className="font-semibold text-center flex items-center justify-center">
        {projectName}
        {hasUnsavedChanges && (
          <span
            className="ml-2 size-2 rounded-full bg-gray-900 dark:bg-gray-100"
            title="Unsaved Changes (Ctrl+S to save)"
          />
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCompile}
          disabled={isCompiling || isCompileDisabled}
          title={
            isCompileDisabled
              ? 'No IEC-61131 (.st) files to compile'
              : 'Compile all IEC-61131 files under Control (Ctrl+Shift+C)'
          }
          className="flex items-center"
        >
          <Code className="h-4 w-4 mr-1" />
          {isCompiling ? 'Compiling...' : 'Compile All'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDeploy}
          disabled={isDeployDisabled || !isConnected || isDeploying}
          title={
            isDeployDisabled
              ? 'Only IEC-61131 (.st) files can be deployed'
              : 'Deploy to Runtime (Ctrl+Shift+D)'
          }
          className="flex items-center"
        >
          <Upload className="h-4 w-4 mr-1" />
          {isDeploying ? 'Deploying...' : 'Deploy'}
        </Button>
        <Button
          variant={isConnected ? 'default' : 'outline'}
          size="sm"
          onClick={handleToggleConnection}
          title={
            isConnected
              ? 'Disconnect from All Controllers'
              : 'Connect to All Controllers'
          }
          className={`flex items-center ${
            isConnected ? 'bg-green-600 hover:bg-green-700' : ''
          }`}
        >
          {isConnected ? (
            <>
              <Power className="h-4 w-4 mr-1" />
              Disconnect
              {totalControllers > 0 && (
                <span className="ml-1 text-xs">
                  ({connectedCount}/{totalControllers})
                </span>
              )}
            </>
          ) : (
            <>
              <Plug className="h-4 w-4 mr-1" />
              Connect
              {totalControllers > 0 && (
                <span className="ml-1 text-xs">({totalControllers})</span>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
