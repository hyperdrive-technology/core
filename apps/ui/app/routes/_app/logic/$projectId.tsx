import { createFileRoute } from '@tanstack/react-router';

// Temporarily disabling TypeScript errors to allow the route to work
// @ts-ignore
export const Route = createFileRoute('/_app/logic/$projectId')({
  component: LogicEditor,
});

function LogicEditor() {
  // @ts-ignore
  const { projectId } = Route.useParams();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          Logic Editor - Project {projectId}
        </h1>
      </div>
      <div className="flex-1 border rounded-md overflow-hidden p-4">
        <p>Logic editor for project {projectId} will go here.</p>
      </div>
    </div>
  );
}
