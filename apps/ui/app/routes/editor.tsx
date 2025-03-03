import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

// Lazy load the Monaco Editor component to prevent affecting initial load time
const MonacoEditor = React.lazy(() => import('../components/MonacoEditor'));

export const Route = createFileRoute('/editor')({
  component: EditorPage,
});

function EditorPage() {
  return (
    <div className="w-full h-full">
      <div className="h-16 border-b flex items-center px-4 dark:border-gray-700">
        <h1 className="text-xl font-semibold">Code Editor</h1>
      </div>

      <React.Suspense fallback={<div className="p-4">Loading editor...</div>}>
        <MonacoEditor />
      </React.Suspense>
    </div>
  );
}
