import { createFileRoute } from '@tanstack/react-router';
import { Navbar } from '../../components/navbar';

// Temporarily disabling TypeScript errors to allow the route to work
// @ts-ignore
export const Route = createFileRoute('/logic/$projectId')({
  component: LogicEditor,
});

function LogicEditor() {
  // @ts-ignore
  const { projectId } = Route.useParams();

  return (
    <div className="flex flex-col h-screen">
      <Navbar version="0.1.0" isConnected={true} />
      <div className="flex-grow"></div>
    </div>
  );
}
