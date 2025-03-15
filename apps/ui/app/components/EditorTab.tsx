import { Activity, Database, Server, X } from 'lucide-react';
import React from 'react';
import { FileNode } from './types';

export type TabType = 'file' | 'variables' | 'trends' | 'status';

interface EditorTabProps {
  file: FileNode;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  hasUnsavedChanges: boolean;
  tabType?: TabType;
}

/**
 * EditorTab component that displays a tab for an open file or special tab
 */
export default function EditorTab({
  file,
  isActive,
  onClick,
  onClose,
  hasUnsavedChanges,
  tabType = 'file',
}: EditorTabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Render appropriate icon based on tab type
  const renderIcon = () => {
    switch (tabType) {
      case 'variables':
        return <Database className="h-3 w-3 mr-1" />;
      case 'trends':
        return <Activity className="h-3 w-3 mr-1" />;
      case 'status':
        return <Server className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  // Determine tab title based on tab type
  const getTabTitle = () => {
    switch (tabType) {
      case 'variables':
        return `Variables: ${file.name}`;
      case 'trends':
        return `Trends: ${file.name}`;
      case 'status':
        return `Status: ${file.name}`;
      default:
        return file.name;
    }
  };

  return (
    <div
      className={`flex items-center h-8 px-3 border-r border-gray-200 dark:border-gray-700 cursor-pointer ${
        isActive
          ? 'bg-white dark:bg-gray-900'
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
      onClick={onClick}
    >
      {renderIcon()}
      <span className="truncate max-w-[150px]">{getTabTitle()}</span>
      {hasUnsavedChanges && (
        <span className="ml-1 text-blue-600 dark:text-blue-400">●</span>
      )}
      <button
        className="ml-2 p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={handleClose}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
