import { useRouter } from "next/router";
import { useState } from "react";

type Project = {
  id: string;
  name: string;
  lastOpened: Date;
};

export default function HomePage() {
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  const handleNewProject = () => {
    const projectId = crypto.randomUUID();
    router.push(`/project/${projectId}`);
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">Inrush IDE</h1>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-2xl font-semibold">Quick Actions</h2>
            <button
              onClick={handleNewProject}
              className="w-full rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
              data-testid="new-project-button"
            >
              New Project
            </button>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-2xl font-semibold">Recent Projects</h2>
            {recentProjects.length === 0 ? (
              <p className="text-gray-500">No recent projects</p>
            ) : (
              <ul className="space-y-2">
                {recentProjects.map((project) => (
                  <li
                    key={project.id}
                    className="flex cursor-pointer items-center justify-between rounded p-2 hover:bg-gray-50"
                    onClick={() => handleOpenProject(project.id)}
                  >
                    <span>{project.name}</span>
                    <span className="text-sm text-gray-500">
                      {project.lastOpened.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
