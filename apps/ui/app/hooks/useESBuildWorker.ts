import * as esbuild from 'esbuild-wasm';
import { useCallback, useEffect, useState } from 'react';
import { FileNode } from '../components/types';

interface UseESBuildWorkerResult {
  previewComponent: (file: FileNode) => void;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  clearCache: () => void;
  isReady: boolean;
}

/**
 * React hook for previewing React components using esbuild-wasm
 */
export function useESBuildWorker(): UseESBuildWorkerResult {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false); // Added state for initialization

  useEffect(() => {
    const initializeESBuild = async () => {
      if (isInitializing || isReady) return; // Prevent multiple initializations

      setIsInitializing(true);
      try {
        await esbuild.initialize({
          wasmURL: './esbuild.wasm', // Updated to use the copied wasm file
        });
        console.log('esbuild initialized successfully');
        setIsReady(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Failed to initialize esbuild:', errorMessage);
        setError(`Failed to initialize esbuild: ${errorMessage}`);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeESBuild();
  }, [isInitializing, isReady]); // Added dependencies to prevent redundant calls

  const previewComponent = useCallback(
    async (file: FileNode) => {
      if (!isReady) {
        setError('esbuild is not ready yet');
        return;
      }

      if (!file.content) {
        setError('Component has no content');
        return;
      }

      setIsLoading(true);
      setError(null);
      setPreviewUrl(null);

      try {
        const result = await esbuild.transform(file.content, {
          loader: 'tsx',
          target: 'es2015',
        });

        // Create a complete HTML page with necessary scripts to render the React component
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Component Preview</title>
              <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
              <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
              <style>
                body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
                .bg-gray-800 { background-color: #1f2937; }
                .p-4 { padding: 1rem; }
                .rounded-lg { border-radius: 0.5rem; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                .justify-center { justify-content: center; }
                .space-y-2 > * + * { margin-top: 0.5rem; }
                .w-16 { width: 4rem; }
                .h-16 { height: 4rem; }
                .w-12 { width: 3rem; }
                .h-12 { height: 3rem; }
                .rounded-full { border-radius: 9999px; }
                .bg-red-600 { background-color: #dc2626; }
                .bg-red-900 { background-color: #7f1d1d; }
                .bg-yellow-400 { background-color: #facc15; }
                .bg-yellow-900 { background-color: #713f12; }
                .bg-green-500 { background-color: #22c55e; }
                .bg-green-900 { background-color: #14532d; }
                .bg-red-600\\/20 { background-color: rgba(220, 38, 38, 0.2); }
                .bg-yellow-400\\/20 { background-color: rgba(250, 204, 21, 0.2); }
                .bg-green-500\\/20 { background-color: rgba(34, 197, 94, 0.2); }
                .mt-4 { margin-top: 1rem; }
                .text-xs { font-size: 0.75rem; }
                .text-gray-400 { color: #9ca3af; }
                .shadow-\\[0_0_20px_rgba\\(220\\,38\\,38\\,0\\.7\\)\\] { box-shadow: 0 0 20px rgba(220, 38, 38, 0.7); }
                .shadow-\\[0_0_20px_rgba\\(250\\,204\\,21\\,0\\.7\\)\\] { box-shadow: 0 0 20px rgba(250, 204, 21, 0.7); }
                .shadow-\\[0_0_20px_rgba\\(34\\,197\\,94\\,0\\.7\\)\\] { box-shadow: 0 0 20px rgba(34, 197, 94, 0.7); }
              </style>
            </head>
            <body>
              <div id="root"></div>
              <script>
                // Make React and ReactDOM globally available
                window.React = React;
                window.ReactDOM = ReactDOM;

                // Create a function to render the component
                function renderComponent(Component) {
                  if (Component) {
                    ReactDOM.createRoot(document.getElementById('root')).render(
                      React.createElement(Component, {
                        plcVariables: { RedLight: true, YellowLight: false, GreenLight: false }
                      })
                    );
                  } else {
                    document.getElementById('root').innerHTML =
                      '<div style="color: red">Error: No component exported from this file</div>';
                  }
                }

                // Modified component code - remove import and export statements
                (function() {
                  ${result.code
                    .replace(
                      /import React from "react";/,
                      '// React is already defined globally'
                    )
                    .replace(/export default function/, 'function')
                    .replace(/export default class/, 'class')
                    .replace(/export function/, 'function')
                    .replace(/export class/, 'class')
                    .replace(/export const/, 'const')
                    .replace(/export let/, 'let')
                    .replace(/export var/, 'var')}

                  // Expose the component to the global scope
                  window.ComponentToRender = typeof TrafficLights !== 'undefined' ? TrafficLights :
                                           typeof default_1 !== 'undefined' ? default_1 :
                                           window.default || window.Component;

                  // Render it
                  renderComponent(window.ComponentToRender);
                })();
              </script>
            </body>
          </html>
        `;

        const blob = new Blob([htmlContent], {
          type: 'text/html',
        });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        console.log('Preview URL ready:', url);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(
          'Error transforming component with esbuild:',
          errorMessage
        );
        setError(`Error transforming component: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    },
    [isReady]
  );

  const clearCache = useCallback(() => {
    console.log('Clearing esbuild cache');
    // esbuild-wasm does not have a specific cache to clear, but this is a placeholder
  }, []);

  return {
    previewComponent,
    previewUrl,
    isLoading,
    error,
    clearCache,
    isReady,
  };
}
