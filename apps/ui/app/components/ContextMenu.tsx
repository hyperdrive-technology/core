import { FilePlus, FolderPlus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { FileNode } from '../server/load-examples.server';

interface ContextMenuProps {
  show: boolean;
  node: FileNode | null;
  type: 'file' | 'folder' | 'background';
  onAddFile: (parentNode: FileNode | null, isFolder: boolean) => void;
  onDelete: (node: FileNode) => void;
  onClose: () => void;
  children: React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  show,
  node,
  type,
  onAddFile,
  onDelete,
  onClose,
  children,
}) => {
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
            {/* Add File option */}
            <button
              onClick={handleAddFile}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FilePlus className="h-4 w-4" />
              <span>Add File</span>
            </button>

            {/* Add Folder option */}
            <button
              onClick={handleAddFolder}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FolderPlus className="h-4 w-4" />
              <span>Add Folder</span>
            </button>

            {/* Delete option (only for file or folder) */}
            {(type === 'file' || type === 'folder') && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete {type === 'folder' ? 'Folder' : 'File'}</span>
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
