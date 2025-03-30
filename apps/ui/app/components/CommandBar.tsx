import { Code, Plug, Power, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useWebSocket } from './context/WebSocketContext';
import { Button } from './ui/button';

export interface CommandBarProps {
  projectName: string;
  onCompile?: () => void;
  onDeploy?: () => void;
  onShowCompileResults?: () => void;
  hasCompilationResult?: boolean;
  isSuccessfullyCompiled?: boolean;
  hasChangesSinceCompilation?: boolean;
  actions?: {
    onCompile?: () => void;
    onDeploy?: () => void;
  };
  hasChanges?: boolean;
  isCompiling?: boolean;
  isDeploying?: boolean;
  isCompileDisabled?: boolean;
  isDeployDisabled?: boolean;
  isConnected?: boolean;
  lastCompiledAt?: string;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  projectName,
  onCompile,
  onDeploy,
  onShowCompileResults,
  hasCompilationResult,
  isSuccessfullyCompiled,
  hasChangesSinceCompilation,
  actions,
  hasChanges = hasChangesSinceCompilation,
  isCompiling,
  isDeploying,
  isCompileDisabled,
  isDeployDisabled,
  isConnected,
  lastCompiledAt,
}) => {
  const {
    controllers,
    connect: connectAll,
    disconnect: disconnectAll,
    isControllerConnecting,
    connectingControllers,
  } = useWebSocket();

  // Add debugging
  useEffect(() => {
    // Removed debug console logs to reduce console spam
  }, [controllers, connectingControllers, isConnected, isControllerConnecting]);

  const anyControllerConnecting = useCallback(() => {
    const result = controllers.some((controller) =>
      isControllerConnecting(controller.id)
    );
    return result;
  }, [controllers, isControllerConnecting]);

  // Connection toggle handler
  const handleConnectionToggle = () => {
    if (isConnected) {
      disconnectAll();
    } else {
      connectAll();
    }
  };

  // Determine button text based on connection status
  const connectionBtnText = useMemo(() => {
    // Check if any controllers are in connecting state
    const anyConnecting = controllers.some((controller) =>
      connectingControllers.has(controller.id)
    );

    if (anyConnecting) {
      return 'Connecting...';
    }
    return isConnected ? 'Disconnect' : 'Connect';
  }, [isConnected, controllers, connectingControllers]);

  // Determine if the button should be disabled
  const isConnectionBtnDisabled = useMemo(() => {
    return controllers.some((controller) =>
      connectingControllers.has(controller.id)
    );
  }, [controllers, connectingControllers]);

  const connectedCount = controllers.filter((c) => c.isConnected).length;
  const totalControllers = controllers.length;

  // Handle compile click with fallback
  const handleCompileClick = () => {
    // If there are changes since the last compilation, always recompile
    if (hasChangesSinceCompilation) {
      if (actions?.onCompile) actions.onCompile();
      else if (onCompile) onCompile();
    }
    // If no changes and previous results exist, show results
    else if (hasCompilationResult && !isCompiling && onShowCompileResults) {
      onShowCompileResults();
    }
    // Otherwise (no changes, no results OR currently compiling), trigger compile
    else {
      if (actions?.onCompile) actions.onCompile();
      else if (onCompile) onCompile();
    }
  };

  // Handle deploy click with fallback
  const handleDeployClick = () => {
    if (actions?.onDeploy) {
      actions.onDeploy();
    } else if (onDeploy) {
      onDeploy();
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b dark:border-gray-700  dark:bg-gray-900">
      <div />
      {/* Center - Project name */}
      <div className="font-semibold text-center flex items-center justify-center">
        {projectName}
        {(hasChanges || hasChangesSinceCompilation) && (
          <span
            className="ml-2 size-2 rounded-full bg-gray-900 dark:bg-gray-100"
            title="Changes since last compilation (Ctrl+Shift+C to compile)"
          />
        )}
        {lastCompiledAt && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            Last compile: {lastCompiledAt}
          </span>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCompileClick}
          disabled={isCompiling || isCompileDisabled}
          title={
            isCompiling
              ? 'Compilation in progress...'
              : isCompileDisabled
              ? 'No IEC-61131 (.st) files to compile'
              : hasChangesSinceCompilation
              ? 'Compile changes (Ctrl+Shift+C)'
              : hasCompilationResult
              ? 'Show previous compilation results'
              : 'Compile all IEC-61131 files (Ctrl+Shift+C)'
          }
          className="flex items-center"
        >
          <Code className="h-4 w-4 mr-1" />
          {isCompiling
            ? 'Compiling...'
            : hasChangesSinceCompilation
            ? 'Compile All'
            : hasCompilationResult
            ? 'Show Results'
            : 'Compile All'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeployClick}
          disabled={
            isDeploying ||
            !isConnected ||
            !isSuccessfullyCompiled ||
            hasChangesSinceCompilation
          }
          title={
            isDeploying
              ? 'Deployment in progress...'
              : !isConnected
              ? 'Connect to controllers first to enable deploy'
              : !isSuccessfullyCompiled
              ? 'Project must be successfully compiled first'
              : hasChangesSinceCompilation
              ? 'Compile changes before deploying'
              : 'Deploy compiled code to Runtime (Ctrl+Shift+D)'
          }
          className="flex items-center"
        >
          <Upload className="h-4 w-4 mr-1" />
          {isDeploying ? 'Deploying...' : 'Deploy'}
        </Button>
        <Button
          variant={isConnected ? 'default' : 'outline'}
          size="sm"
          onClick={handleConnectionToggle}
          disabled={isConnectionBtnDisabled}
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
              {connectionBtnText}
              {totalControllers > 0 && (
                <span className="ml-1 text-xs">
                  ({connectedCount}/{totalControllers})
                </span>
              )}
            </>
          ) : (
            <>
              <Plug className="h-4 w-4 mr-1" />
              {connectionBtnText}
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
