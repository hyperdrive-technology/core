import {
  ChevronDown,
  ChevronRight,
  Code,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Layout,
  Server,
} from 'lucide-react';
import React, { useState } from 'react';
import ContextMenu from '../ContextMenu';
import { FileNode } from '../types';

interface FilesTabProps {
  files: FileNode[];
  onSelectFile: (node: FileNode) => void;
  selectedFileId: string | null;
  onAddFile: (parentNode: FileNode | null, isFolder: boolean) => void;
  onDeleteFile: (node: FileNode) => void;
  onDeploy: (node: FileNode) => void;
  onAddController?: () => void;
}

export default function FilesTab({
  files,
  onSelectFile,
  selectedFileId,
  onAddFile,
  onDeleteFile,
  onDeploy,
  onAddController,
}: FilesTabProps) {
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
        {files.map((file) => (
          <TreeNode
            key={file.id}
            node={file}
            level={0}
            onSelectFile={onSelectFile}
            selectedFileId={selectedFileId}
            onContextMenu={handleContextMenu}
          />
        ))}
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
        onClose={closeContextMenu}
        onDeploy={onDeploy}
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
}

// TreeNode Component
export function TreeNode({
  node,
  level,
  onSelectFile,
  selectedFileId,
  onContextMenu,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(
    node.nodeType === 'heading' ? true : false,
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

  // Helper function to get the appropriate icon for heading nodes
  const getHeadingIcon = () => {
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
  };

  return (
    <div>
      <div
        className={`flex items-center p-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
          selectedFileId === node.id ? 'bg-gray-200 dark:bg-gray-700' : ''
        } ${node.nodeType === 'heading' ? 'font-bold text-sm border-b border-gray-300 dark:border-gray-600' : ''}`}
        style={{
          paddingLeft:
            node.nodeType === 'heading' ? '4px' : `${level * 12 + 4}px`,
        }}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        data-node-type={node.nodeType || (node.isFolder ? 'folder' : 'file')}
        data-node-id={node.id}
      >
        {node.isFolder && node.nodeType !== 'heading' && (
          <span className="flex items-center">
            <span className="mr-1 cursor-pointer" onClick={handleToggle}>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="mr-1">
              {isOpen ? (
                <FolderOpen className="h-4 w-4 text-yellow-500" />
              ) : (
                <Folder className="h-4 w-4 text-yellow-500" />
              )}
            </span>
          </span>
        )}
        {node.nodeType === 'heading' && (
          <span className="flex items-center">
            <span className="mr-1 cursor-pointer" onClick={handleToggle}>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="mr-1">{getHeadingIcon()}</span>
          </span>
        )}
        {node.nodeType === 'controller' && (
          <span className="ml-5 mr-2">
            <div className="size-2 rounded-full bg-green-500" title="Online" />
          </span>
        )}
        {!node.isFolder && node.nodeType !== 'controller' && (
          <span className="ml-5 mr-1">
            <File className="h-4 w-4 text-blue-500" />
          </span>
        )}
        <span className="truncate">{node.name}</span>
        {node.nodeType === 'controller' && node.metadata && (
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({node.metadata.ip}, v{node.metadata.version})
          </span>
        )}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
