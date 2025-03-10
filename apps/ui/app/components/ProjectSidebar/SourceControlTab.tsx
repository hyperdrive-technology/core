import {
  File,
  GitBranch,
  GitCommit,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FileNode } from '../types';

export interface SourceControlTabProps {
  files: FileNode[];
  onSelectFile: (node: FileNode) => void;
}

export default function SourceControlTab({
  files,
  onSelectFile,
}: SourceControlTabProps) {
  files = files;
  onSelectFile = onSelectFile;
  // Git state
  const [gitStatus, setGitStatus] = useState<{
    branch: string;
    changes: { file: string; status: 'modified' | 'added' | 'deleted' }[];
    commits: { hash: string; message: string; author: string; date: string }[];
  }>({
    branch: 'main',
    changes: [],
    commits: [],
  });

  // Mock function to refresh git status (would be connected to actual Git in a real implementation)
  const refreshGitStatus = () => {
    // Mock data for demonstration
    setGitStatus({
      branch: 'main',
      changes: [
        { file: 'Logic/Programs/Main.st', status: 'modified' },
        { file: 'Control/Dashboard.tsx', status: 'added' },
      ],
      commits: [
        {
          hash: 'a1b2c3d',
          message: 'Add controller dashboard',
          author: 'User',
          date: new Date().toLocaleDateString(),
        },
        {
          hash: '4e5f6g7',
          message: 'Initial commit',
          author: 'User',
          date: new Date(Date.now() - 86400000).toLocaleDateString(),
        },
      ],
    });
  };

  // Initialize with mock git data
  useEffect(() => {
    refreshGitStatus();
  }, []);

  return (
    <>
      <div className="p-2 font-semibold flex justify-between items-center border-b dark:border-gray-700">
        <span>Source Control</span>
      </div>
      <div className="flex flex-col">
        <div className="p-2 flex justify-between items-center border-b dark:border-gray-700">
          <div className="flex items-center">
            <GitBranch className="h-4 w-4 mr-2" />
            <span className="text-sm">{gitStatus.branch}</span>
          </div>
          <button
            onClick={refreshGitStatus}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto p-2">
          {/* Changes Section */}
          <div className="mb-6">
            <div className="font-medium border-b pb-1 mb-2 flex items-center justify-between">
              <span>Changes</span>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                {gitStatus.changes.length}
              </span>
            </div>

            {gitStatus.changes.length > 0 ? (
              <div className="space-y-1">
                {gitStatus.changes.map((change, index) => (
                  <div
                    key={index}
                    className="text-sm flex items-start p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                  >
                    {change.status === 'modified' && (
                      <span
                        className="text-yellow-600 dark:text-yellow-500 mr-2"
                        title="Modified"
                      >
                        <File className="h-4 w-4" />
                      </span>
                    )}
                    {change.status === 'added' && (
                      <span
                        className="text-green-600 dark:text-green-500 mr-2"
                        title="Added"
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    )}
                    {change.status === 'deleted' && (
                      <span
                        className="text-red-600 dark:text-red-500 mr-2"
                        title="Deleted"
                      >
                        <Minus className="h-4 w-4" />
                      </span>
                    )}
                    <span className="truncate">{change.file}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No changes detected in your workspace.
              </div>
            )}

            {gitStatus.changes.length > 0 && (
              <button className="mt-2 flex items-center gap-1 text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200 rounded-md">
                <GitCommit className="h-3 w-3" />
                <span>Commit Changes</span>
              </button>
            )}
          </div>

          {/* Commits Section */}
          <div>
            <div className="font-medium border-b pb-1 mb-2">Commits</div>

            {gitStatus.commits.length > 0 ? (
              <div className="space-y-3">
                {gitStatus.commits.map((commit, index) => (
                  <div
                    key={index}
                    className="text-sm p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {commit.hash}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {commit.date}
                      </span>
                    </div>
                    <div className="font-medium">{commit.message}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {commit.author}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No commits found in this repository.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
