import { FileCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useIECCompiler } from '../hooks/useIECCompiler';
import { IECFile } from '../utils/iec-file-loader';
import { Badge } from './ui/badge';

interface CompilePanelProps {
  files?: IECFile[];
  onCompilationSuccess?: (result: any) => void;
}

/**
 * CompilePanel component for compiling IEC-61131 files
 * This uses a Web Worker to perform compilation in the browser
 */
export function CompilePanel({
  files = [],
  onCompilationSuccess,
}: CompilePanelProps) {
  const { compile, result, status, error } = useIECCompiler();
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Debug component mount and props
  useEffect(() => {
    console.log('🔍 CompilePanel mounted with files:', files);
    console.log('🔍 Initial compiler status:', status);
  }, []);

  // Add more verbose logs to handle compile
  const handleCompile = async () => {
    console.log('🚀 Compile button clicked');
    console.log('🚀 Files to compile:', files);

    if (!files || files.length === 0) {
      console.error('❌ No files available for compilation');
      toast.error('No IEC-61131 files available for compilation');
      return;
    }

    setIsLoading(true);
    // Clear previous logs
    setLogs([`Starting compilation of ${files.length} IEC-61131 file(s)...`]);
    console.log(
      `🚀 Starting compilation of ${files.length} IEC-61131 file(s)...`
    );

    // Log the files being compiled
    files.forEach((file) => {
      console.log(`🚀 Compiling file: ${file.fileName}`);
      setLogs((prev) => [...prev, `Compiling file: ${file.fileName}`]);
    });

    toast.info(`Compiling ${files.length} IEC-61131 file(s)`);
    console.log('🚀 Calling compile function...');
    compile(files);
    console.log('🚀 Compile function called');
  };

  // Add more debugging to the useEffect
  useEffect(() => {
    console.log('🔄 Compiler status changed:', status);
    console.log('🔄 Compiler result:', result);
    console.log('🔄 Compiler error:', error);

    if (status === 'success' || status === 'error') {
      console.log('✅ Compilation completed with status:', status);
      setIsLoading(false);

      // Show toast based on result
      if (status === 'success' && result?.success) {
        console.log('✅ Compilation successful:', result);
        setLogs((prev) => [
          ...prev,
          `✅ Compilation successful for ${result.fileCount} file(s)`,
        ]);
        toast.success(`Successfully compiled ${result.fileCount} file(s)`);

        // Call success callback if provided
        if (onCompilationSuccess && result) {
          console.log('✅ Calling onCompilationSuccess callback');
          onCompilationSuccess(result);
        }
      } else if (status === 'error' || (result && !result.success)) {
        console.error('❌ Compilation failed:', error || 'Unknown error');
        setLogs((prev) => [
          ...prev,
          `❌ Compilation failed: ${error || 'Unknown error'}`,
        ]);
        toast.error('Compilation failed');
      }

      // Add logs about diagnostics
      if (result?.diagnostics) {
        console.log('📋 Diagnostics:', result.diagnostics);
        result.diagnostics.forEach((fileDiag) => {
          console.log(
            `📋 Diagnostics for ${fileDiag.fileName}:`,
            fileDiag.diagnostics
          );
          setLogs((prev) => [...prev, `Diagnostics for ${fileDiag.fileName}:`]);

          if (fileDiag.diagnostics.length === 0) {
            setLogs((prev) => [...prev, `  No issues found`]);
          } else {
            fileDiag.diagnostics.forEach((diag) => {
              const prefix = diag.severity === 'error' ? '❌' : '⚠️';
              const logMsg = `  ${prefix} Line ${diag.line}, Col ${diag.column}: ${diag.message}`;
              console.log(logMsg);
              setLogs((prev) => [...prev, logMsg]);
            });
          }
        });
      }

      // Log info about the AST if available
      if (result?.ast) {
        console.log('🏗️ Generated AST:', result.ast);
        setLogs((prev) => [
          ...prev,
          `Generated AST for ${
            Array.isArray(result.ast) ? result.ast.length : 1
          } file(s)`,
        ]);
      }
    }
  }, [status, result, error, onCompilationSuccess]);

  // Add a new function to format the AST for display
  const formatASTForDisplay = (ast: any): string[] => {
    if (!ast) return ['No AST data available'];

    const lines: string[] = [`AST Type: ${ast.type}`];

    // Add program declarations
    if (ast.programs && ast.programs.length > 0) {
      lines.push(`Programs (${ast.programs.length}):`);
      ast.programs.forEach((prog: any) => {
        lines.push(`  - ${prog.name} (type: ${prog.type})`);
      });
    }

    // Add function block declarations
    if (ast.functionBlocks && ast.functionBlocks.length > 0) {
      lines.push(`Function Blocks (${ast.functionBlocks.length}):`);
      ast.functionBlocks.forEach((fb: any) => {
        lines.push(`  - ${fb.name} (type: ${fb.type})`);
      });
    }

    // Add function declarations
    if (ast.functions && ast.functions.length > 0) {
      lines.push(`Functions (${ast.functions.length}):`);
      ast.functions.forEach((func: any) => {
        lines.push(`  - ${func.name} (type: ${func.type})`);
      });
    }

    return lines;
  };

  // Update the event handler to include AST information
  const handleCompilationResult = (event: CustomEvent<any>) => {
    const compilationResult = event.detail;
    console.log('CompilePanel received compilation result:', compilationResult);

    if (!compilationResult) return;

    // Update status based on compilation success
    setIsLoading(false);

    // Clear previous logs before adding new ones
    setLogs([
      `Received compilation results for ${compilationResult.fileCount} file(s)`,
    ]);

    // Update logs with compilation results
    if (compilationResult.success) {
      setLogs((prev) => [
        ...prev,
        `✅ Compilation successful for ${compilationResult.fileCount} file(s)`,
      ]);
    } else {
      setLogs((prev) => [...prev, `❌ Compilation failed`]);
    }

    // Process diagnostics
    if (compilationResult.diagnostics) {
      compilationResult.diagnostics.forEach(
        (fileDiag: {
          fileName: string;
          diagnostics: Array<{
            line: number;
            column: number;
            message: string;
            severity: 'error' | 'warning';
          }>;
        }) => {
          setLogs((prev) => [...prev, `Diagnostics for ${fileDiag.fileName}:`]);

          if (fileDiag.diagnostics.length === 0) {
            setLogs((prev) => [...prev, `  No issues found`]);
          } else {
            fileDiag.diagnostics.forEach(
              (diag: {
                line: number;
                column: number;
                message: string;
                severity: 'error' | 'warning';
              }) => {
                const prefix = diag.severity === 'error' ? '❌' : '⚠️';
                const logMsg = `  ${prefix} Line ${diag.line}, Col ${diag.column}: ${diag.message}`;
                setLogs((prev) => [...prev, logMsg]);
              }
            );
          }
        }
      );
    }

    // Add AST information if compilation was successful
    if (compilationResult.success && compilationResult.ast) {
      // First add the header lines
      setLogs((prev) => [
        ...prev,
        '', // Empty line for spacing
        '🏗️ AST Structure:',
      ]);

      // Then add each formatted AST line
      const astLines = formatASTForDisplay(compilationResult.ast);
      for (const line of astLines) {
        setLogs((prev) => [...prev, `  ${line}`]);
      }

      // Add JSON representation
      setLogs((prev) => [
        ...prev,
        '', // Empty line for spacing
        '🔍 AST as JSON:',
      ]);

      try {
        // Format the JSON with indentation for readability
        const jsonStr = JSON.stringify(compilationResult.ast, null, 2);
        // Split the JSON into lines and add each line to the logs
        const jsonLines = jsonStr.split('\n');
        for (const line of jsonLines) {
          setLogs((prev) => [...prev, `  ${line}`]);
        }
      } catch (error) {
        setLogs((prev) => [
          ...prev,
          `  Error formatting AST as JSON: ${error}`,
        ]);
      }
    }
  };

  // Add an effect to listen for compilation events
  useEffect(() => {
    // Register event listener
    window.addEventListener(
      'iec-compilation-result',
      handleCompilationResult as EventListener
    );

    // Clean up on unmount
    return () => {
      window.removeEventListener(
        'iec-compilation-result',
        handleCompilationResult as EventListener
      );
    };
  }, []);

  return (
    <>
      {/* Log output */}
      <div className="bg-slate-900 text-slate-50 dark:bg-slate-950 p-4 rounded-md h-80 overflow-y-auto mb-4 border border-slate-700">
        <h3 className="text-sm font-semibold mb-2 text-slate-300">
          Compilation Output:
        </h3>
        {logs.length === 0 ? (
          <p className="text-slate-400">
            Use the "Compile All" button in the command bar to start
            compilation.
          </p>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => {
              // Style different types of logs
              let className = 'text-xs font-mono';

              if (log.includes('❌')) className += ' text-red-400';
              else if (log.includes('⚠️')) className += ' text-yellow-400';
              else if (log.includes('✅')) className += ' text-green-400';
              else if (log.startsWith('  ')) className += ' text-slate-400';

              return (
                <div key={index} className={className}>
                  {log}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Only show results if available */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Compilation Results</h3>
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? 'Success' : 'Failed'}
            </Badge>
          </div>

          {/* Display diagnostics summary */}
          {result.diagnostics && (
            <div>
              <h4 className="text-sm font-medium mb-2">Diagnostics:</h4>
              {result.diagnostics.map((fileDiag, fileIndex) => (
                <div key={fileIndex} className="mb-3">
                  <div className="flex items-center">
                    <FileCode className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">
                      {fileDiag.fileName}
                    </span>
                  </div>

                  {fileDiag.diagnostics.length === 0 ? (
                    <p className="text-xs text-success ml-6 mt-1">
                      No issues found
                    </p>
                  ) : (
                    <div className="ml-6 mt-1 space-y-1">
                      {fileDiag.diagnostics.map((diag, diagIndex) => (
                        <div
                          key={diagIndex}
                          className={`text-xs ${
                            diag.severity === 'error'
                              ? 'text-destructive'
                              : 'text-warning'
                          }`}
                        >
                          {diag.severity === 'error' ? '❌' : '⚠️'} Line{' '}
                          {diag.line}, Col {diag.column}: {diag.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
