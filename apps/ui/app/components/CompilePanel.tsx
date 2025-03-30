import { FileCode } from 'lucide-react';
import { Badge } from './ui/badge';

// Define types based on the structure observed in the original component
export interface Diagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface FileDiagnostic {
  fileName: string;
  diagnostics: Diagnostic[];
}

// Define CompileResult based on the hook's likely output structure
export interface CompileResult {
  success: boolean;
  fileCount?: number;
  diagnostics?: FileDiagnostic[];
  ast?: any; // Keep AST as any for now, or define a more specific type if known
  sourceCode?: string;
  error?: string; // Added optional error field
}

interface CompilationOutputPanelProps {
  logs: string[];
  result: CompileResult | null;
}

/**
 * CompilationOutputPanel component for displaying results of IEC-61131 compilation
 */
export function CompilationOutputPanel({
  logs,
  result,
}: CompilationOutputPanelProps) {
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

  return (
    <>
      {/* Log output - uses logs prop */}
      <div className="bg-slate-900 text-slate-50 dark:bg-slate-950 p-4 rounded-md h-full overflow-y-auto border border-slate-700">
        <h3 className="text-sm font-semibold mb-2 text-slate-300">
          Compilation Output:
        </h3>
        {logs.length === 0 ? (
          <p className="text-slate-400">No compilation output available.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => {
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

      {/* Show results summary if result prop is provided */}
      {result && (
        <div className="space-y-4 mt-4 p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Compilation Summary</h3>
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? 'Success' : 'Failed'}
            </Badge>
          </div>

          {/* Display diagnostics summary from result prop */}
          {result.diagnostics && result.diagnostics.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Diagnostics:</h4>
              {result.diagnostics.map(
                (fileDiag: FileDiagnostic, fileIndex: number) => (
                  <div key={fileIndex} className="mb-3">
                    <div className="flex items-center">
                      <FileCode className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">
                        {fileDiag.fileName}
                      </span>
                    </div>

                    {fileDiag.diagnostics.length === 0 ? (
                      <p className="text-xs text-green-400 ml-6 mt-1">
                        No issues found
                      </p>
                    ) : (
                      <div className="ml-6 mt-1 space-y-1">
                        {fileDiag.diagnostics.map(
                          (diag: Diagnostic, diagIndex: number) => (
                            <div
                              key={diagIndex}
                              className={`text-xs ${
                                diag.severity === 'error'
                                  ? 'text-red-400'
                                  : 'text-yellow-400' // Use yellow for warnings
                              }`}
                            >
                              {diag.severity === 'error' ? '❌' : '⚠️'} Line{' '}
                              {diag.line}, Col {diag.column}: {diag.message}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
