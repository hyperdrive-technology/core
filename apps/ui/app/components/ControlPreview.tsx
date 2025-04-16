import { useESBuildWorker } from '@/hooks/useESBuildWorker';
import React, { useEffect, useRef, useState } from 'react';
import { FileNode } from './types';

interface ControlPreviewProps {
  file: FileNode;
}

const ControlPreview: React.FC<ControlPreviewProps> = ({ file }) => {
  const {
    previewComponent,
    previewUrl,
    isLoading,
    error,
    clearCache,
    isReady,
  } = useESBuildWorker();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [initAttempts, setInitAttempts] = useState(0);

  // Initialize the preview when the component mounts or file changes
  useEffect(() => {
    // Only try to preview if the worker is ready, or retry a few times
    if (isReady) {
      console.log('ESBuild is ready, previewing component:', file.name);
      previewComponent(file);
    } else if (initAttempts < 3) {
      console.log(
        `Waiting for ESBuild to be ready (attempt ${initAttempts + 1}/3)...`
      );
      // Delay each retry with increasing timeout
      const timeout = setTimeout(() => {
        setInitAttempts((prev) => prev + 1);
        previewComponent(file);
      }, 1000 * (initAttempts + 1));

      return () => clearTimeout(timeout);
    }
  }, [file, previewComponent, isReady, initAttempts]);

  // Handle iframe load event
  const handleIframeLoad = () => {
    console.log('Preview iframe loaded');
  };

  // Handle iframe error event
  const handleIframeError = (
    event: React.SyntheticEvent<HTMLIFrameElement>
  ) => {
    console.error('Iframe load error:', event);
  };

  // Handle manual refresh
  const handleRefresh = () => {
    clearCache();
    setInitAttempts(0); // Reset attempts counter
    previewComponent(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none h-10 px-4 border-b flex items-center justify-between bg-gray-50 dark:bg-gray-800">
        <h2 className="text-sm font-medium">Preview: {file.name}</h2>
        <button
          onClick={handleRefresh}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading preview...
              </p>
            </div>
          </div>
        )}

        {!isReady && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Initializing ESBuild preview engine...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="max-w-md p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md">
              <h3 className="font-bold mb-2">Error</h3>
              <p className="text-sm mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {previewUrl && (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="Component Preview"
            sandbox="allow-scripts"
          />
        )}
      </div>
    </div>
  );
};

export default ControlPreview;
