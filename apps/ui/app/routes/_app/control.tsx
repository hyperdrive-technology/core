import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/control')({
  component: ViewerPage,
});

function ViewerPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Control</h1>
      </div>
      <div className="flex-1 border rounded-md overflow-hidden p-4">
        <p>SCADA control content will go here.</p>
      </div>
    </div>
  );
}
