import {
  ChevronDown,
  ChevronRight,
  Code,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  Layout,
  Server,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import ContextMenu from '../ContextMenu';
import { FileNode } from '../types';

interface FilesTabProps {
  files: FileNode[];
  onSelectFile: (node: FileNode) => void;
  selectedFileId: string | null;
  onAddFile: (parentNode: FileNode | null, isFolder: boolean) => void;
  onDeleteFile: (node: FileNode) => void;
  onDeploy?: (node: FileNode) => void;
  onAddController?: () => void;
  onOpenVariableMonitor?: (node: FileNode) => void;
  onOpenTrends?: (node: FileNode) => void;
  onViewControllerStatus?: (node: FileNode) => void;
}

export default function FilesTab({
  files,
  onSelectFile,
  selectedFileId,
  onAddFile,
  onDeleteFile,
  onDeploy,
  onAddController,
  onOpenVariableMonitor,
  onOpenTrends,
  onViewControllerStatus,
}: FilesTabProps) {
  const { connect, disconnect, getControllerStatus, addController } =
    useWebSocket();
  const [contextMenu, setContextMenu] = useState({
    show: false,
    node: null as FileNode | null,
    type: 'file' as 'file' | 'folder' | 'background',
  });

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation(); // Ensure the event doesn't bubble up

    // Update context menu state
    setContextMenu({
      show: true,
      node,
      type: node.isFolder ? 'folder' : 'file',
    });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Ensure the event doesn't bubble up

    // If we're clicking directly on a node, the node's onContextMenu handler will take care of it
    // This handler is only for clicks on the background

    setContextMenu({
      show: true,
      node: null,
      type: 'background',
    });
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, show: false }));
  };

  // Handler for connecting to a controller
  const handleConnectController = (node: FileNode) => {
    if (node.nodeType === 'controller' && node.id) {
      // If the controller is not in the WebSocket context, add it
      if (node.metadata?.ip) {
        addController(node.id, node.name, node.metadata.ip);
      }

      // Connect to the controller
      connect(node.id);
    }
  };

  // Handler for disconnecting from a controller
  const handleDisconnectController = (node: FileNode) => {
    if (node.nodeType === 'controller' && node.id) {
      disconnect(node.id);
    }
  };

  // Handler for viewing controller status
  const handleViewControllerStatus = (node: FileNode) => {
    if (node.nodeType === 'controller' && onViewControllerStatus) {
      onViewControllerStatus(node);
    }
  };

  return (
    <>
      <div className="" onContextMenu={handleBackgroundContextMenu}>
        <div className="p-2 font-semibold flex justify-between items-center border-b dark:border-gray-700">
          <span>Files</span>
          <div className="flex space-x-1">
            <button
              onClick={() => onAddFile(null, false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
              title="Add new file"
            >
              <FilePlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => onAddFile(null, true)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
              title="Add new folder"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            {onAddController && (
              <button
                onClick={onAddController}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
                title="Add new controller"
              >
                <Server className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="p-2 overflow-auto">
          {files.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              onSelectFile={onSelectFile}
              selectedFileId={selectedFileId}
              onContextMenu={handleContextMenu}
              getControllerStatus={getControllerStatus}
            />
          ))}
        </div>
      </div>

      {/* Render the context menu separately */}
      <ContextMenu
        show={contextMenu.show}
        node={contextMenu.node}
        type={
          contextMenu.node?.nodeType === 'controller'
            ? 'controller'
            : contextMenu.node?.isFolder
            ? 'folder'
            : 'file'
        }
        onAddFile={onAddFile}
        onDelete={onDeleteFile}
        onDeploy={onDeploy}
        onOpenVariableMonitor={onOpenVariableMonitor}
        onOpenTrends={onOpenTrends}
        onConnectController={handleConnectController}
        onDisconnectController={handleDisconnectController}
        onViewControllerStatus={handleViewControllerStatus}
        onClose={closeContextMenu}
      >
        <></>
      </ContextMenu>
    </>
  );
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  onSelectFile: (node: FileNode) => void;
  selectedFileId: string | null;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  getControllerStatus: (controllerId: string) => boolean;
}

// TreeNode Component
export function TreeNode({
  node,
  level,
  onSelectFile,
  selectedFileId,
  onContextMenu,
  getControllerStatus,
}: TreeNodeProps) {
  const { controllers, isControllerConnecting } = useWebSocket();
  const menuRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(
    node.nodeType === 'heading' ? true : false
  );

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isFolder) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.isFolder || node.nodeType === 'controller') {
      onSelectFile(node);
    } else {
      // For folders, toggle expansion when clicked
      setIsOpen(!isOpen);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  // Function to get the icon based on node type
  const getHeadingIcon = () => {
    if (node.nodeType === 'heading') {
      switch (node.name) {
        case 'Devices':
          return <Server className="h-4 w-4 text-zinc-500" />;
        case 'Logic':
          return <Code className="h-4 w-4 text-zinc-500" />;
        case 'Control':
          return <Layout className="h-4 w-4 text-zinc-500" />;
        default:
          return <Folder className="h-4 w-4 text-blue-600" />;
      }
    }
    return null;
  };

  // Check if this node is a controller and if it's connected
  const isController = node.nodeType === 'controller';
  const nodeIsConnected =
    isController && node.id ? getControllerStatus(node.id) : false;

  const renderStatusIndicator = () => {
    if (node.nodeType !== 'controller') return null;

    const isConnected = controllers.some(
      (controller) => controller.id === node.id && controller.isConnected
    );

    const isConnecting = isControllerConnecting(node.id);

    if (isConnecting) {
      return (
        <div
          className="size-2 rounded-full bg-yellow-400 absolute right-2"
          title="Connecting..."
        />
      );
    }

    if (isConnected) {
      return (
        <div
          className="size-2 rounded-full bg-green-500 absolute right-2"
          title="Connected"
        />
      );
    }

    return (
      <div
        className="size-2 rounded-full bg-red-500 absolute right-2"
        title="Disconnected"
      />
    );
  };

  return (
    <div ref={menuRef}>
      <div
        className={`flex items-center px-2 h-7 text-sm relative ${
          selectedFileId === node.id ? 'bg-blue-500/20' : ''
        } cursor-pointer group`}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
      >
        {node.isFolder && node.nodeType !== 'heading' && (
          <div className="mr-1 flex items-center justify-center w-4">
            {node.children && node.children.length > 0 ? (
              isOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : null}
          </div>
        )}
        {node.nodeType === 'heading' && (
          <div className="mr-3 flex items-center justify-center w-4">
            <span className="mr-1 cursor-pointer" onClick={handleToggle}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="mr-1">{getHeadingIcon()}</span>
          </div>
        )}
        {node.nodeType === 'controller' && (
          <span className="ml-5 mr-1">
            <Server className="h-4 w-4 text-purple-500" />
          </span>
        )}
        {!node.isFolder && node.nodeType !== 'controller' && (
          <span className="ml-5 mr-1">
            <File className="h-4 w-4 text-blue-500" />
          </span>
        )}
        <span className="truncate">{node.name}</span>
        {renderStatusIndicator()}
      </div>
      {node.isFolder && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={node.nodeType === 'heading' ? 0 : level + 1}
              onSelectFile={onSelectFile}
              selectedFileId={selectedFileId}
              onContextMenu={onContextMenu}
              getControllerStatus={getControllerStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
