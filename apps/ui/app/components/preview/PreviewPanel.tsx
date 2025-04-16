import { useEffect, useRef, useState } from 'react';

interface PreviewPanelProps {
  code: string;
  fileName?: string;
}

/**
 * Component that renders a preview of React/TypeScript code
 * Uses a Vite worker to compile and render the component
 */
export function PreviewPanel({ code }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the worker from the global context
    // The worker is initialized in the MonacoEditor component
    const viteWorker = (window as any).__VITE_PREVIEW_WORKER__;

    if (!viteWorker) {
      setError(
        'Preview worker not initialized. The component preview feature is not available.'
      );
      setLoading(false);
      return;
    }

    // Set up message handler for worker responses
    const handleWorkerMessage = (event: MessageEvent) => {
      const { type, path, message } = event.data;

      if (type === 'preview-ready' && path && iframeRef.current) {
        // Update iframe with the preview URL
        iframeRef.current.src = path;
        setLoading(false);
        setError(null);
      } else if (type === 'error') {
        console.error('Preview error:', message);
        setError(message || 'Unknown error creating preview');
        setLoading(false);
      }
    };

    // Add event listener for worker messages
    viteWorker.addEventListener('message', handleWorkerMessage);

    // Update the preview with the current code
    if (code) {
      setLoading(true);
      viteWorker.postMessage({
        type: 'update-preview',
        id: 'preview-component',
        code,
      });
    }

    // Clean up event listener
    return () => {
      viteWorker.removeEventListener('message', handleWorkerMessage);
    };
  }, [code]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Compiling preview...
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 overflow-auto">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 w-full max-w-2xl">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                Preview Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                <pre className="whitespace-pre-wrap font-mono text-xs overflow-auto max-h-64 bg-white dark:bg-gray-950 p-2 rounded">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="Component Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
