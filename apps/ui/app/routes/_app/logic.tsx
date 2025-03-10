import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import MonacoEditor from '../../components/MonacoEditor';
import {
  FileNode,
  loadExampleProjects,
} from '../../server/load-examples.server';

export const Route = createFileRoute('/_app/logic')({
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

          // The example projects already have the Devices, Logic, and Control structure
          // Find those directories and transform them into heading nodes
          const structuredProject: FileNode[] = [];

          if (project.children) {
            // Find the Devices, Logic, and Control directories
            const devicesDir = project.children.find(
              (node) => node.isFolder && node.name.toLowerCase() === 'devices',
            );

            const logicDir = project.children.find(
              (node) => node.isFolder && node.name.toLowerCase() === 'logic',
            );

            const controlDir = project.children.find(
              (node) => node.isFolder && node.name.toLowerCase() === 'control',
            );

            // Add the Devices section
            structuredProject.push({
              id: 'devices-section',
              name: 'Devices',
              isFolder: true,
              nodeType: 'heading',
              children: devicesDir?.children?.length
                ? // If we already have controllers, use them
                  devicesDir.children.map((child) => {
                    // Make sure all JSON files in the devices folder are properly marked as controllers
                    if (
                      !child.isFolder &&
                      child.name.toLowerCase().endsWith('.json') &&
                      child.nodeType !== 'controller'
                    ) {
                      return {
                        ...child,
                        nodeType: 'controller',
                        metadata: child.metadata || {
                          ip: '192.168.1.100',
                          version: '1.0.0',
                        },
                      };
                    }
                    return child;
                  })
                : // Otherwise create a default controller
                  [
                    {
                      id: 'controller-1',
                      name: 'Controller1.json',
                      isFolder: false,
                      nodeType: 'controller',
                      content: JSON.stringify(
                        {
                          name: 'Controller1',
                          ip: '192.168.1.100',
                          version: '1.0.0',
                          status: 'online',
                          description:
                            'Main PLC controller for production line',
                        },
                        null,
                        2,
                      ),
                      metadata: {
                        ip: '192.168.1.100',
                        version: '1.0.0',
                        description: 'Main PLC controller for production line',
                      },
                    },
                  ],
            });

            // Add the Logic section
            structuredProject.push({
              id: 'logic-section',
              name: 'Logic',
              isFolder: true,
              nodeType: 'heading',
              children: logicDir?.children || [],
            });

            // Add the Control section
            structuredProject.push({
              id: 'control-section',
              name: 'Control',
              isFolder: true,
              nodeType: 'heading',
              children: controlDir?.children?.length
                ? controlDir.children
                : [
                    // Default dashboard component if the Control directory is empty
                    {
                      id: 'dashboard',
                      name: 'Dashboard.tsx',
                      isFolder: false,
                      content: `import React from 'react';
import { Card, Button } from './components';

export default function Dashboard() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Controller Dashboard</h1>
      <Card className="p-4">
        <h2 className="text-lg font-medium">Status: Online</h2>
        <div className="mt-2">
          <Button>Refresh</Button>
        </div>
      </Card>
    </div>
  );
}`,
                      nodeType: 'file',
                    },
                  ],
            });
          }

          setProjectFiles(structuredProject);
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
