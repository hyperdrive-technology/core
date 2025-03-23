import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useIECCompiler } from '../hooks/useIECCompiler';
import { IECFile } from '../utils/iec-file-loader';

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
}
