import { ChevronRight, Code, FileCode, FileText, Folder } from 'lucide-react';
import React, { useState } from 'react';
import { FileNode } from './types';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from './ui/breadcrumb';

interface BreadcrumbPathProps {
  path: string;
  filePath?: string;
  currentFunction?: string;
  fileName?: string;
  repoName?: string; // Add repo name prop
  onNavigate?: (path: string) => void; // Add callback for navigation
  onSelectFile?: (fileNode: FileNode) => void; // Using the correct FileNode type
  activeFileId?: string; // Add active file ID prop
  fileTree?: FileNode[]; // Using FileNode instead of FileTreeItem
}

interface DropdownItemProps {
  item: FileNode;
  onSelect: (item: FileNode) => void;
  depth?: number;
}

// Separate component for dropdown items to handle nested folders
const DropdownItem: React.FC<DropdownItemProps> = ({
  item,
  onSelect,
  depth = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(item);
    }
  };

  return (
    <>
      <button
        className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center group"
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {item.isFolder ? (
          <>
            <ChevronRight
              className={`h-3 w-3 mr-1.5 text-gray-500 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
            <Folder className="h-3 w-3 mr-1.5 text-blue-500 dark:text-blue-400" />
          </>
        ) : (
          <FileCode className="h-3 w-3 mr-1.5 text-orange-500 dark:text-orange-400 ml-4" />
        )}
        <span className="truncate">{item.name}</span>
      </button>

      {/* Render children if folder is expanded */}
      {item.isFolder && isExpanded && item.children && (
        <div className="w-full">
          {item.children.map((child) => (
            <DropdownItem
              key={child.id}
              item={child}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </>
  );
};

/**
 * BreadcrumbPath component that displays a VSCode-like path with folders, file, and current function
 */
export default function BreadcrumbPath({
  path,
  filePath,
  currentFunction,
  fileName,
  repoName = 'example-1', // Default to example-1 if not provided
  onNavigate,
  onSelectFile,
  activeFileId,
  fileTree = [],
}: BreadcrumbPathProps) {
  // State to track which dropdown is open
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(
    null
  );

  // Parse the path into segments
  const hasPath = path && path.length > 0;

  // Start with repo name instead of core/apps/ui
  const pathSegments = hasPath
    ? [repoName, ...path.split('/').filter(Boolean)]
    : [repoName];

  // Parse the file path if available
  const fileSegments = filePath ? filePath.split('/').filter(Boolean) : [];

  // The last segment of fileSegments would be the filename or use provided fileName
  const displayFileName =
    fileName ||
    (fileSegments.length > 0 ? fileSegments[fileSegments.length - 1] : null);

  // Function to handle folder click - toggle dropdown
  const handleFolderClick = (index: number) => {
    setOpenDropdownIndex(openDropdownIndex === index ? null : index);
  };

  // Function to handle file/folder selection from dropdown
  const handleItemSelect = (item: FileNode) => {
    setOpenDropdownIndex(null);
    if (!item.isFolder) {
      // If it's a file, use the onSelectFile callback with the full node
      if (onSelectFile) {
        console.log('BreadcrumbPath: Selecting file node:', item.name);
        onSelectFile(item);
      } else if (onNavigate && item.path) {
        console.log('BreadcrumbPath: Navigating to path:', item.path);
        onNavigate(item.path);
      } else {
        console.warn(
          'BreadcrumbPath: Cannot navigate to file - missing item data'
        );
      }
    }
  };

  // Function to handle file click from breadcrumb trail
  const handleFileClick = () => {
    // Find the current file node in the tree if we have activeFileId
    if (activeFileId && onSelectFile) {
      // Find the file node in the tree
      const findNodeById = (
        nodes: FileNode[],
        id: string
      ): FileNode | undefined => {
        for (const node of nodes) {
          if (node.id === id) {
            return node;
          }
          if (node.isFolder && node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
          }
        }
        return undefined;
      };

      const fileNode = findNodeById(fileTree || [], activeFileId);
      if (fileNode) {
        console.log(
          'BreadcrumbPath: Selecting file node by ID:',
          fileNode.name
        );
        onSelectFile(fileNode);
      } else {
        console.warn(
          'BreadcrumbPath: Could not find file node with ID:',
          activeFileId
        );
      }
    } else if (filePath && onNavigate) {
      console.log('BreadcrumbPath: Navigating to path:', filePath);
      onNavigate(filePath);
    } else {
      console.warn(
        'BreadcrumbPath: Cannot navigate to file - missing ID and path'
      );
    }
  };

  // Function to get sibling files and folders at a given path level
  const getSiblings = (index: number): FileNode[] => {
    // For the root level, show top-level folders/files
    if (index === 0) {
      return fileTree || [];
    }

    // For other levels, find the corresponding parent folder and return its children
    // Build the parent path
    const parentPath = pathSegments.slice(1, index + 1).join('/');

    // Helper function to find a folder by path
    const findFolderByPath = (
      items: FileNode[],
      path: string
    ): FileNode | null => {
      for (const item of items) {
        if (item.isFolder && item.path === path) {
          return item;
        }
        if (item.isFolder && item.children && item.children.length > 0) {
          const found = findFolderByPath(item.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    // Find the parent folder in the file tree
    const parentFolder = findFolderByPath(fileTree || [], parentPath);

    // Return the children of the parent folder or an empty array if not found
    return parentFolder?.children || [];
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-850 py-1 px-2 border-b border-gray-200 dark:border-gray-700 flex items-center text-xs">
      <Breadcrumb>
        <BreadcrumbList>
          {/* Folder segments */}
          {pathSegments.map((segment, index) => (
            <React.Fragment key={`folder-${index}`}>
              <BreadcrumbItem className="relative">
                <BreadcrumbLink
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 py-0.5 px-1 rounded transition-colors flex items-center cursor-pointer"
                  onClick={() => handleFolderClick(index)}
                >
                  <Folder className="h-3 w-3 inline mr-1 text-blue-500 dark:text-blue-400" />
                  <span>{segment}</span>
                </BreadcrumbLink>

                {/* Dropdown menu for this folder */}
                {openDropdownIndex === index && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10 min-w-[200px] max-h-[400px] overflow-y-auto">
                    {getSiblings(index).map((item) => (
                      <DropdownItem
                        key={item.id}
                        item={item}
                        onSelect={handleItemSelect}
                      />
                    ))}
                  </div>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </React.Fragment>
          ))}

          {/* File name */}
          {displayFileName && (
            <BreadcrumbItem>
              <BreadcrumbLink
                className="hover:bg-gray-200 dark:hover:bg-gray-700 py-0.5 px-1 rounded transition-colors cursor-pointer"
                onClick={handleFileClick}
              >
                <FileText className="h-3 w-3 inline mr-1 text-orange-500 dark:text-orange-400" />
                <span>{displayFileName}</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}

          {/* Current function */}
          {currentFunction && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="hover:bg-gray-200 dark:hover:bg-gray-700 py-0.5 px-1 rounded transition-colors">
                  <Code className="h-3 w-3 inline mr-1 text-purple-500 dark:text-purple-400" />
                  <span>{currentFunction}</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
