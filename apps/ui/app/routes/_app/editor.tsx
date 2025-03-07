import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import MonacoEditor from '../../components/MonacoEditor';
import {
  FileNode,
  loadExampleProjects,
} from '../../server/load-examples.server';

export const Route = createFileRoute('/_app/editor')({
  component: EditorPage,
  errorComponent: ({ error }) => {
    console.error('Editor route error:', error);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h1 className="text-xl font-bold text-red-800 mb-2">Editor Error</h1>
        <p className="text-red-600">{error?.message || 'Unknown error'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  },
});

function EditorPage() {
  // Access the project files from the location state
  const location = window.location;
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get('projectId');
  const projectName = searchParams.get('projectName');
  const [projectFiles, setProjectFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the example project files
  useEffect(() => {
    const fetchProjectFiles = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const allExampleProjects = await loadExampleProjects();

        // Find the project with the matching ID
        const project = allExampleProjects.find((p) => p.id === projectId);

        if (project) {
          console.log('Loaded project files:', project.name);
          setProjectFiles([project]);
        } else {
          console.error('Project not found with ID:', projectId);
          setError(`Project not found with ID: ${projectId}`);
        }
      } catch (error) {
        console.error('Error loading project files:', error);
        setError('Error loading project files. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectFiles();
  }, [projectId]);

  return (
    <div className="h-screen flex flex-col">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p>Loading project...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md max-w-md">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      ) : (
        <MonacoEditor
          initialFiles={projectFiles.length > 0 ? projectFiles : undefined}
        />
      )}
    </div>
  );
}
