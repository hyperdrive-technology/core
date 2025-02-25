// app/routes/index.tsx
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowUpDown, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"
import { createProject } from "../server/create-project.server"

interface Project {
  id: string
  name: string
  description: string
  lastOpened: string
}

// This would come from your API
const mockProjects: Project[] = [
  {
    id: "1",
    name: "Factory Line A",
    description: "Main production line configuration",
    lastOpened: "2 days ago",
  },
  {
    id: "2",
    name: "Warehouse System",
    description: "Automated storage and retrieval system",
    lastOpened: "1 week ago",
  },
]

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createProject({
        data: {
          name: projectName,
          description: projectDescription,
        }
      });

      // Navigate to the new project using string template
      // @ts-ignore - temporary fix for route type issue
      navigate({ to: `/logic/${result.id}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    setError(null);
    setIsCreating(false);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar version="0.1.0" isConnected={true} />

      <main className="flex-1 container mx-auto max-w-4xl p-8 mt-24">
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
                    <Button variant="ghost" className="h-8 flex items-center gap-2">
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
                    <Button variant="ghost" className="h-8 flex items-center gap-2">
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
                    <div className="flex items-center text-muted-foreground">{project.description}</div>
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex items-center justify-center text-muted-foreground">{project.lastOpened}</div>
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex items-center justify-end">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-0" align="end">
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              className="flex items-center justify-start px-4 py-2 hover:bg-muted"
                              // @ts-ignore - temporary fix for route type issue
                              onClick={() => navigate({ to: `/logic/${project.id}` })}
                            >
                              Open
                            </Button>
                            <Button
                              variant="ghost"
                              className="flex items-center justify-start px-4 py-2 text-destructive hover:bg-muted"
                              onClick={() => console.log(`Deleting project ${project.id}`)}
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
      </main>

      {/* New Project Dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsCreating(open);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter the details for your new project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="col-span-3"
                placeholder="My Project"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="col-span-3"
                placeholder="Project description (optional)"
              />
            </div>
            {error && (
              <div className="text-destructive text-sm mt-2">{error}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
