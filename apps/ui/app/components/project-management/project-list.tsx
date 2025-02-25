import { Button } from '@/components/ui/button';
import { createProject } from '@/server/create-project.server';
import { useNavigate } from '@tanstack/react-router';
import { PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProjectCard } from '../project-card';
import { NewProjectDialog } from './new-project-dialog';

interface Project {
  id: string;
  name: string;
  description: string;
  modified: string;
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch projects from API
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    // @ts-ignore - temporary fix for route type issue
    navigate({ to: `/logic/${projectId}` });
  };

  const handleCreateProject = async (name: string, description: string) => {
    try {
      const result = await createProject({
        data: {
          name,
          description,
          tags: []
        }
      });

      // Add the new project to the list
      const newProject = {
        id: result.id,
        name: result.name,
        description: result.description,
        modified: result.created
      };

      setProjects([...projects, newProject]);
      setIsNewProjectDialogOpen(false);

      // Navigate to the editor
      // @ts-ignore - temporary fix for route type issue
      navigate({ to: `/logic/${result.id}` });
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <Button onClick={() => setIsNewProjectDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted">
          <p className="mb-4">You don't have any projects yet.</p>
          <Button onClick={() => setIsNewProjectDialogOpen(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              name={project.name}
              description={project.description}
              lastOpened={new Date(project.modified).toLocaleDateString()}
              onClick={() => handleOpenProject(project.id)}
            />
          ))}
        </div>
      )}

      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setIsNewProjectDialogOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}
