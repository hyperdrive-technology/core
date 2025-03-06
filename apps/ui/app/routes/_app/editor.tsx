import { createFileRoute } from '@tanstack/react-router';
import MonacoEditor from '../../components/MonacoEditor';

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
  return (
    <div className="h-full flex flex-col">
      <MonacoEditor />
    </div>
  );
}
