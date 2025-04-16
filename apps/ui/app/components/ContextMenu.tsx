import {
  Activity,
  Box,
  Database,
  FilePlus,
  FolderPlus,
  Plug,
  Power,
  Server,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useWebSocket } from './context/WebSocketContext';
import { FileNode } from './types';

interface ContextMenuProps {
  show: boolean;
  node: FileNode | null;
  type: 'file' | 'folder' | 'background' | 'controller';
  onAddFile: (parentNode: FileNode | null, isFolder: boolean) => void;
  onDelete: (node: FileNode) => void;
  onClose: () => void;
  children: React.ReactNode;
  onDeploy?: (node: FileNode) => void;
  onOpenVariableMonitor?: (node: FileNode) => void;
  onOpenTrends?: (node: FileNode) => void;
  onConnectController?: (node: FileNode) => void;
  onDisconnectController?: (node: FileNode) => void;
  onViewControllerStatus?: (node: FileNode) => void;
  onPreviewControl?: (node: FileNode) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  show,
  node,
  type,
  onAddFile,
  onDelete,
  onClose,
  children,
  onDeploy,
  onOpenVariableMonitor,
  onOpenTrends,
  onConnectController,
  onDisconnectController,
  onViewControllerStatus,
  onPreviewControl,
}) => {
  const { getControllerStatus } = useWebSocket();
  // Track context menu position
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isOpen, setIsOpen] = useState(false);

  // Add debugging logs
  useEffect(() => {
    console.log('ContextMenu props changed:', {
      show,
      type,
      nodeName: node?.name,
    });

    // Update the open state based on the show prop
    setIsOpen(show);

    // Get the last mouse position for the context menu
    if (show) {
      const mouseEvent = window.event as MouseEvent;
      if (mouseEvent) {
        setPosition({
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
        });
        console.log('Setting context menu position:', {
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
        });
      }
    }
  }, [show, node, type]);

  const handleAddFile = () => {
    console.log('Add file clicked');
    onAddFile(node, false);
    onClose();
  };

  const handleAddFolder = () => {
    console.log('Add folder clicked');
    onAddFile(node, true);
    onClose();
  };

  const handleDelete = () => {
    console.log('Delete clicked for:', node?.name);
    if (node) {
      onDelete(node);
      onClose();
    }
  };

  const handleDeploy = () => {
    console.log('Deploy clicked for:', node?.name);
    if (node && onDeploy) {
      onDeploy(node);
      onClose();
    }
  };

  const handleOpenVariableMonitor = () => {
    console.log('Open Variable Monitor clicked for:', node?.name);
    if (node && onOpenVariableMonitor) {
      onOpenVariableMonitor(node);
      onClose();
    }
  };

  const handleOpenTrends = () => {
    console.log('Open Trends clicked for:', node?.name);
    if (node && onOpenTrends) {
      onOpenTrends(node);
      onClose();
    }
  };

  const handleConnectController = () => {
    console.log('Connect controller clicked for:', node?.name);
    if (node && onConnectController) {
      onConnectController(node);
      onClose();
    }
  };

  const handleDisconnectController = () => {
    console.log('Disconnect controller clicked for:', node?.name);
    if (node && onDisconnectController) {
      onDisconnectController(node);
      onClose();
    }
  };

  // Add a new handler for viewing controller status
  const handleViewControllerStatus = () => {
    console.log('View controller status clicked for:', node?.name);
    if (node && onViewControllerStatus) {
      onViewControllerStatus(node);
      onClose();
    }
  };

  const handlePreviewControl = () => {
    console.log('[ContextMenu] Preview Control clicked for:', node?.name);
    if (node && onPreviewControl && !node.name.startsWith('_')) {
      onPreviewControl(node);
      onClose();
    }
  };

  // Check if the node is a controller
  const isController = node?.nodeType === 'controller';

  // Check if the controller is connected
  const isControllerConnected =
    isController && node?.id ? getControllerStatus(node.id) : false;

  // Check if the node is a heading section
  const isHeading = node?.nodeType === 'heading';

  // Get specific heading type if it's a heading
  const headingType = isHeading ? node?.name : null;

  // Determine if the preview option should be shown
  const canPreviewControl =
    type === 'file' &&
    node &&
    !node.name.startsWith('_') &&
    node.name.match(/\.(jsx|tsx)$/) &&
    onPreviewControl;

  if (show && node && node.name.match(/\.(jsx|tsx)$/)) {
    console.log(
      `[ContextMenu] Checking preview for ${
        node.name
      }: type=${type}, startsWith=_: ${node.name.startsWith(
        '_'
      )}, handlerExists: ${!!onPreviewControl}, canPreview: ${!!canPreviewControl}`
    );
  }

  // Create a custom context menu that appears at the mouse position
  return (
    <>
      {children}

      {isOpen && (
        <div
          className="fixed z-50"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-md border border-gray-200 dark:border-gray-700 py-1 w-64">
            {/* Controller-specific options */}
            {isController && (
              <>
                {isControllerConnected ? (
                  <button
                    onClick={handleDisconnectController}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Power className="h-4 w-4" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleConnectController}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Plug className="h-4 w-4" />
                    <span>Connect</span>
                  </button>
                )}

                <button
                  onClick={handleViewControllerStatus}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Server className="h-4 w-4" />
                  <span>View Status</span>
                </button>

                <button
                  onClick={handleDeploy}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  disabled={!isControllerConnected}
                >
                  <Upload className="h-4 w-4" />
                  <span>Deploy</span>
                </button>

                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              </>
            )}

            {/* Monitoring options for files, folders, and controllers */}
            {(type === 'file' || type === 'folder' || isController) &&
              !isHeading &&
              onOpenVariableMonitor && (
                <button
                  onClick={handleOpenVariableMonitor}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Database className="h-4 w-4" />
                  <span>Open Variable Monitor</span>
                </button>
              )}

            {/* Trends option - only for .st files */}
            {type === 'file' &&
              !isHeading &&
              onOpenTrends &&
              node?.name.toLowerCase().endsWith('.st') && (
                <button
                  onClick={handleOpenTrends}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Activity className="h-4 w-4" />
                  <span>Open Trends</span>
                </button>
              )}

            {/* ADDED: Control Preview Option */}
            {canPreviewControl && (
              <button
                onClick={handlePreviewControl}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Box className="h-4 w-4" />
                <span>Preview Component</span>
              </button>
            )}

            {/* Separator logic might need adjustment if Preview is added */}
            {(type === 'file' || type === 'folder' || isController) &&
              !isHeading &&
              (onOpenVariableMonitor ||
                (onOpenTrends &&
                  (type !== 'file' ||
                    node?.name.toLowerCase().endsWith('.st'))) ||
                canPreviewControl) && (
                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              )}

            {/* Devices-specific options */}
            {isHeading && headingType === 'Devices' && (
              <button
                onClick={() => {
                  onClose();
                  // This would trigger the add controller function
                  if (onAddFile) {
                    onAddFile(node, false);
                  }
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Server className="h-4 w-4" />
                <span>Add Controller</span>
              </button>
            )}

            {/* Logic-specific options */}
            {isHeading && headingType === 'Logic' && (
              <button
                onClick={handleAddFile}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FilePlus className="h-4 w-4" />
                <span>Add Logic File</span>
              </button>
            )}

            {/* Control-specific options */}
            {isHeading && headingType === 'Control' && (
              <button
                onClick={handleAddFile}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FilePlus className="h-4 w-4" />
                <span>Add UI Component</span>
              </button>
            )}

            {/* Add File option - only for folders and general headings */}
            {(type === 'folder' ||
              (isHeading &&
                !['Devices', 'Logic', 'Control'].includes(
                  headingType || ''
                ))) && (
              <button
                onClick={handleAddFile}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FilePlus className="h-4 w-4" />
                <span>Add File</span>
              </button>
            )}

            {/* Add Folder option - only for folders and general headings */}
            {(type === 'folder' ||
              (isHeading && !['Devices'].includes(headingType || ''))) && (
              <button
                onClick={handleAddFolder}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FolderPlus className="h-4 w-4" />
                <span>Add Folder</span>
              </button>
            )}

            {/* Delete option (only for regular files, folders or controllers) */}
            {(type === 'file' || type === 'folder' || isController) &&
              !isHeading && (
                <>
                  {(type === 'file' || type === 'folder') && !isController && (
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  )}
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>
                      Delete{' '}
                      {isController
                        ? 'Controller'
                        : type === 'folder'
                        ? 'Folder'
                        : 'File'}
                    </span>
                  </button>
                </>
              )}
          </div>
        </div>
      )}

      {/* Add a click handler to close the menu when clicking outside */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={onClose} />}
    </>
  );
};

export default ContextMenu;
