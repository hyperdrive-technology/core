import { FileText, GitBranch, Search } from 'lucide-react';
import React, { useState } from 'react';
import { FileNode } from '../types';
import FilesTab from './FilesTab';
import SearchTab from './SearchTab';
import SourceControlTab from './SourceControlTab';

// Define the available explorer modes
export type ExplorerMode = 'files' | 'search' | 'git';

export interface ProjectSidebarProps {
  files: FileNode[];
  onSelectFile: (node: FileNode) => void;
  selectedFileId: string | null;
  onAddFile: (parentNode: FileNode | null, isFolder: boolean) => void;
  onDeleteFile: (node: FileNode) => void;
  onDeploy: (node: FileNode) => void;
  onAddController?: () => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  files,
  onSelectFile,
  selectedFileId,
  onAddFile,
  onDeleteFile,
  onDeploy,
  onAddController,
}) => {
  // State for the current explorer mode
  const [explorerMode, setExplorerMode] = useState<ExplorerMode>('files');

  return (
    <div className="h-full flex flex-col">
      {/* Mode Tabs */}
      <div className="h-10 gap-2 flex items-center justify-center border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
        <button
          className={`rounded p-1.5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 ${
            explorerMode === 'files' ? 'bg-gray-200 dark:bg-gray-700' : ''
          }`}
          onClick={() => setExplorerMode('files')}
          title="Files"
        >
          <FileText className="h-4 w-4" />
        </button>
        <button
          className={`rounded p-1.5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 ${
            explorerMode === 'search' ? 'bg-gray-200 dark:bg-gray-700' : ''
          }`}
          onClick={() => setExplorerMode('search')}
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          className={`rounded p-1.5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 ${
            explorerMode === 'git' ? 'bg-gray-200 dark:bg-gray-700' : ''
          }`}
          onClick={() => setExplorerMode('git')}
          title="Source Control"
        >
          <GitBranch className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-auto h-[calc(100%-6rem)]">
        {/* Content area - conditionally render based on mode */}
        {explorerMode === 'files' && (
          <FilesTab
            files={files}
            onSelectFile={onSelectFile}
            selectedFileId={selectedFileId}
            onAddFile={onAddFile}
            onDeleteFile={onDeleteFile}
            onDeploy={onDeploy}
            onAddController={onAddController}
          />
        )}

        {explorerMode === 'search' && (
          <SearchTab files={files} onSelectFile={onSelectFile} />
        )}

        {explorerMode === 'git' && (
          <SourceControlTab files={files} onSelectFile={onSelectFile} />
        )}
      </div>
    </div>
  );
};

export default ProjectSidebar;
