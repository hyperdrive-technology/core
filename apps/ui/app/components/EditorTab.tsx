import { X } from 'lucide-react';
import React from 'react';
import { FileNode } from './types';

interface EditorTabProps {
  file: FileNode;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  hasUnsavedChanges: boolean;
}

/**
 * EditorTab component that displays a tab for an open file
 */
export default function EditorTab({
  file,
  isActive,
  onClick,
  onClose,
  hasUnsavedChanges,
}: EditorTabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
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
      <span className="truncate max-w-[150px]">{file.name}</span>
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
