// app/routes/index.tsx
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from '@/components/ui';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowUpDown,
  Code,
  FolderIcon,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createProject } from '../server/create-project.server';
import { FileNode, loadExampleProjects } from '../server/load-examples.server';

interface Project {
  id: string;
  name: string;
  description: string;
  lastOpened: string;
}

// This would come from your API
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Factory Line A',
    description: 'Main production line configuration',
    lastOpened: '2 days ago',
  },
  {
    id: '2',
    name: 'Warehouse System',
    description: 'Automated storage and retrieval system',
    lastOpened: '1 week ago',
  },
];

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [error, setError] = useState('');
  const [exampleProjects, setExampleProjects] = useState<FileNode[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(true);

  // Load example projects on component mount
  useEffect(() => {
    const fetchExampleProjects = async () => {
      try {
        setLoadingExamples(true);
        const projects = await loadExampleProjects();
        setExampleProjects(projects);
      } catch (error) {
        console.error('Failed to load example projects:', error);
      } finally {
        setLoadingExamples(false);
      }
    };

    fetchExampleProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call your API to create a project
      await createProject({
        data: {
          name: projectName,
          description: projectDescription,
        },
      });

      // Close dialog and reset form
      setIsCreating(false);
      resetForm();

      // Refresh projects list or navigate to the new project
      // For now, just log success
      console.log('Project created successfully');
    } catch (err) {
      setError('Failed to create project');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProjectName('');
    setProjectDescription('');
    setError('');
    setIsCreating(false);
  };

  // Navigate to editor with the selected example project
  const handleOpenExampleProject = (project: FileNode) => {
    navigate({
      to: '/logic',
      search: {
        projectId: project.id,
        projectName: project.name,
      },
    });
  };

  // Example Projects Section
  const renderExampleProjects = () => {
    if (loadingExamples) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-8 border rounded-lg">
          <p className="text-muted-foreground">Loading example projects...</p>
        </div>
      );
    }

    if (exampleProjects.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-8 border rounded-lg">
          <p className="text-muted-foreground">No example projects found</p>
        </div>
      );
    }

    return exampleProjects.map((project) => (
      <div
        key={project.id}
        className="border rounded-lg p-4 hover:border-primary cursor-pointer transition-colors"
        onClick={() => handleOpenExampleProject(project)}
      >
        <div className="flex items-center mb-2">
          <FolderIcon className="h-5 w-5 mr-2 text-primary" />
          <h3 className="font-medium">{project.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {project.isFolder ? 'Example project folder' : 'Example file'}
        </p>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple Navbar */}
      <header className="border-b">
        <div className="flex h-16 items-center px-4 justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold">Inrush</span>
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              v0.1.0
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/logic"
              className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-accent"
            >
              <Code className="h-4 w-4" />
              <span>Logic</span>
            </Link>
            <Link
              to="/control"
              className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-accent"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Control</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Projects</h1>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Project
            </Button>
          </div>

          <div className="rounded-md border">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 flex items-center gap-2"
                      >
                        Name
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                    <div className="flex items-center">Description</div>
                  </th>
                  <th className="h-10 px-4 align-middle font-medium text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <Button
                        variant="ghost"
                        className="h-8 flex items-center gap-2"
                      >
                        Last Opened
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </th>
                  <th className="h-10 w-[50px] px-4 text-right align-middle font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {mockProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="p-4 align-middle">
                      <div className="flex items-center">
                        <span className="font-medium">{project.name}</span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center text-muted-foreground">
                        {project.description}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-center text-muted-foreground">
                        {project.lastOpened}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-end">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-0" align="end">
                            <div className="flex flex-col">
                              <Button
                                variant="ghost"
                                className="flex items-center justify-start px-4 py-2 hover:bg-muted"
                                onClick={() => navigate({ to: `/logic` })}
                              >
                                Open
                              </Button>
                              <Button
                                variant="ghost"
                                className="flex items-center justify-start px-4 py-2 text-destructive hover:bg-muted"
                                onClick={() =>
                                  console.log(`Deleting project ${project.id}`)
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mockProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
              <p className="text-muted-foreground mb-4">
                Create your first project to get started
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Project
              </Button>
            </div>
          )}

          {/* Example Projects Section */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Example Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderExampleProjects()}
            </div>
          </div>

          {/* Create Project Dialog */}
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Enter the details for your new project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter project description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProject} disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
