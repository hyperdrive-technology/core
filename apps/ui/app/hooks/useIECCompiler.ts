import { useCallback, useEffect, useRef, useState } from 'react';
import { IECFile } from '../utils/iec-file-loader';

export interface CompilationDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompilationResult {
  success: boolean;
  diagnostics: Array<{
    fileName: string;
    diagnostics: CompilationDiagnostic[];
  }>;
  fileCount: number;
  ast?: any; // Store the AST for later deployment
}

type CompilerStatus = 'idle' | 'loading' | 'compiling' | 'success' | 'error';

interface UseIECCompilerResult {
  compile: (files: IECFile[]) => void;
  result: CompilationResult | null;
  status: CompilerStatus;
  error: string | null;
  lastCompiledFiles: IECFile[] | null;
}

/**
 * React hook for compiling IEC-61131 files using a web worker
 * Keeps compilation results in memory until deployment
 */
export function useIECCompiler(): UseIECCompilerResult {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [status, setStatus] = useState<CompilerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastCompiledFiles, setLastCompiledFiles] = useState<IECFile[] | null>(
    null
  );

  useEffect(() => {
    // Initialize worker
    if (typeof window !== 'undefined') {
      try {
        workerRef.current = new Worker(
          new URL('../workers/iec-compile.worker.ts', import.meta.url),
          { type: 'module' }
        );

        const worker = workerRef.current;

        // Set up message handler
        worker.onmessage = (event) => {
          const {
            type,
            result: compilationResult,
            error: workerError,
          } = event.data;

          if (type === 'compile-result') {
            setResult(compilationResult);
            setStatus(compilationResult.success ? 'success' : 'error');

            // Dispatch a custom event with the compilation result
            // This allows other components to react to the compilation result
            // without having to pass the result down through props
            if (typeof window !== 'undefined') {
              const customEvent = new CustomEvent('iec-compilation-result', {
                detail: compilationResult,
              });
              window.dispatchEvent(customEvent);
              console.log('Dispatched iec-compilation-result event');
            }
          } else if (type === 'error') {
            setError(workerError || 'Unknown compilation error');
            setStatus('error');
          }
        };

        // Handle worker errors
        worker.onerror = (error) => {
          console.error('Compiler worker error:', error);
          setError(`Worker error: ${error.message}`);
          setStatus('error');
        };
      } catch (err) {
        console.error('Failed to initialize compiler worker:', err);
        setError(
          `Failed to initialize compiler: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    // Cleanup worker on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Function to trigger compilation
  const compile = useCallback((files: IECFile[]) => {
    if (!workerRef.current) {
      setError('Compiler not initialized');
      return;
    }

    // Store the files we're compiling
    setLastCompiledFiles(files);

    // Reset state
    setResult(null);
    setError(null);
    setStatus('compiling');

    console.log(`Compiling ${files.length} IEC-61131 file(s)`);

    // Send files to worker
    workerRef.current.postMessage({
      type: 'compile',
      files: files,
    });
  }, []);

  return {
    compile,
    result,
    status,
    error,
    lastCompiledFiles,
  };
}
