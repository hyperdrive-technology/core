import {
  Activity,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileText,
  Folder,
  FolderOpen,
  Server,
  Tags,
} from 'lucide-react';
import React, { useState } from 'react';
import { FileNode as FileNodeType } from '../types'; // Rename imported type
import NodeActions from './NodeActions';

interface FileNodeProps {
  node: FileNodeType;
  level: number;
  onSelectFile: (node: FileNodeType) => void;
  selectedFileId: string | null;
  onAddFile: (parentNode: FileNodeType | null, isFolder: boolean) => void;
  onDeleteFile: (node: FileNodeType) => void;
  onDeploy?: (node: FileNodeType) => void;
  onAddController?: () => void;
  onOpenTrends?: (node: FileNodeType) => void;
  onViewControllerStatus?: (node: FileNodeType) => void;
  onPreviewControl?: (node: FileNodeType) => void; // Add prop
  onContextMenu: (e: React.MouseEvent, node: FileNodeType) => void;
  getControllerStatus: (controllerId: string) => boolean;
}

const FileNode: React.FC<FileNodeProps> = ({
  node,
  level,
  onSelectFile,
  selectedFileId,
  onAddFile,
  onDeleteFile,
  onDeploy,
  onAddController,
  onOpenTrends,
  onViewControllerStatus,
  onPreviewControl, // Receive prop
  onContextMenu,
  getControllerStatus,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (node.isFolder) {
      setIsOpen(!isOpen);
    }
  };

  const handleClick = () => {
    if (!node.isFolder) {
      onSelectFile(node);
    }
  };

  const renderIcon = () => {
    if (node.isFolder) {
      return isOpen ? (
        <FolderOpen className="h-4 w-4 mr-2" />
      ) : (
        <Folder className="h-4 w-4 mr-2" />
      );
    }
    if (node.nodeType === 'controller') {
      return <Cpu className="h-4 w-4 mr-2" />;
    }
    if (node.nodeType === 'status') {
      return <Server className="h-4 w-4 mr-2" />;
    }
    if (node.nodeType === 'trends') {
      return <Activity className="h-4 w-4 mr-2" />;
    }
    if (node.nodeType === 'heading') {
      return <Tags className="h-4 w-4 mr-2" />;
    }
    // Default to file icon
    return <FileText className="h-4 w-4 mr-2" />;
  };

  const isSelected = selectedFileId === node.id;

  return (
    <div onContextMenu={(e) => onContextMenu(e, node)}>
      <div
        className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''
        }`}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        onClick={node.isFolder ? handleToggle : handleClick}
      >
        <div className="flex items-center flex-1 min-w-0">
          {node.isFolder ? (
            isOpen ? (
              <ChevronDown className="h-4 w-4 mr-1 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-1 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 mr-1 flex-shrink-0"></div> // Placeholder for alignment
          )}
          {renderIcon()}
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
          {node.nodeType === 'controller' && (
            <span
              className={`ml-2 h-2 w-2 rounded-full ${
                getControllerStatus(node.id) ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={getControllerStatus(node.id) ? 'Online' : 'Offline'}
            ></span>
          )}
        </div>
        {/* Actions Menu */}
        {node.nodeType !== 'heading' && (
          <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <NodeActions
              node={node}
              onAddFile={onAddFile}
              onDeleteFile={onDeleteFile}
              onDeploy={onDeploy}
              onOpenTrends={onOpenTrends}
              onViewControllerStatus={onViewControllerStatus}
              onPreviewControl={onPreviewControl} // Pass prop
            />
          </div>
        )}
      </div>
      {node.isFolder && isOpen && node.children && (
        <div className="mt-1">
          {node.children.map((child) => (
            <FileNode
              key={child.id}
              node={child}
              level={level + 1}
              onSelectFile={onSelectFile}
              selectedFileId={selectedFileId}
              onAddFile={onAddFile}
              onDeleteFile={onDeleteFile}
              onDeploy={onDeploy}
              onAddController={onAddController}
              onOpenTrends={onOpenTrends}
              onViewControllerStatus={onViewControllerStatus}
              onPreviewControl={onPreviewControl} // Pass prop recursively
              onContextMenu={onContextMenu}
              getControllerStatus={getControllerStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileNode;
