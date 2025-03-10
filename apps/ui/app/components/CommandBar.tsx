import { Button } from '@/components/ui/button';
import { Plug, Power, Upload } from 'lucide-react';

export interface CommandBarProps {
  projectName: string;
  onDeploy: () => void;
  onToggleConnection: () => void;
  isConnected: boolean;
  hasUnsavedChanges: boolean;
  isDeploying?: boolean;
}

export const CommandBar = ({
  projectName,
  onDeploy,
  onToggleConnection,
  isConnected,
  hasUnsavedChanges,
  isDeploying = false,
}: CommandBarProps) => {
  return (
    <div className="flex items-center justify-between p-2 border-b dark:border-gray-700  dark:bg-gray-900">
      <div />
      {/* Center - Project name */}
      <div className="font-semibold text-center flex items-center justify-center">
        {projectName}
        {hasUnsavedChanges && (
          <span
            className="ml-2 h-2 w-2 rounded-full bg-gray-900 dark:bg-gray-100"
            title="Unsaved Changes (Ctrl+S to save)"
          />
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDeploy}
          disabled={!isConnected}
          title="Deploy to Runtime (Ctrl+Shift+D)"
          className="flex items-center"
        >
          <Upload className="h-4 w-4 mr-1" />
          Deploy
        </Button>
        <Button
          variant={isConnected ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleConnection}
          title={isConnected ? 'Disconnect from Runtime' : 'Connect to Runtime'}
          className={`flex items-center ${isConnected ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {isConnected ? (
            <>
              <Power className="h-4 w-4 mr-1" />
              Disconnect
            </>
          ) : (
            <>
              <Plug className="h-4 w-4 mr-1" />
              Connect
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
