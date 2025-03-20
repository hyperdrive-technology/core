/// <reference lib="webworker" />

console.log('IEC61131 Compiler Worker: Initializing');

import type { Program } from './ast';
import { validateIEC61131Document } from './parser';

console.log('IEC61131 Compiler Worker: Imports loaded successfully');

interface CompilationDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

interface CompilationResult {
  success: boolean;
  diagnostics: Array<{
    fileName: string;
    diagnostics: CompilationDiagnostic[];
  }>;
  fileCount: number;
  ast?: Program;
  error?: string;
}

// Global error handler for worker
self.addEventListener('error', (event) => {
  console.error('IEC61131 Compiler Worker: Global error', event.error);
  self.postMessage({
    type: 'compile-result',
    result: {
      success: false,
      diagnostics: [],
      fileCount: 0,
      error: `Worker error: ${event.message || 'Unknown error'}`,
    } as CompilationResult,
  });
});

// Handle messages from the main thread
self.onmessage = (event) => {
  console.log('IEC61131 Compiler Worker: Received message', event.data?.type);

  try {
    const { type, files } = event.data;

    if (type !== 'compile') {
      console.warn('IEC61131 Compiler Worker: Unknown message type:', type);
      return;
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.error('IEC61131 Compiler Worker: No files to compile');
      self.postMessage({
        type: 'compile-result',
        result: {
          success: false,
          diagnostics: [],
          fileCount: 0,
          error: 'No files to compile',
        } as CompilationResult,
      });
      return;
    }

    console.log(
      'IEC61131 Compiler Worker: Starting compilation of',
      files.length,
      'files'
    );

    const result: CompilationResult = {
      success: true,
      diagnostics: [],
      fileCount: files.length,
    };

    // Process each file using validateIEC61131Document which includes CST to AST conversion
    for (const file of files) {
      console.log(`IEC61131 Compiler Worker: Processing ${file.fileName}`);

      try {
        // Use validateIEC61131Document to parse, validate, and convert CST to AST
        const validationResult = validateIEC61131Document(file.content);

        // Add diagnostics with file names
        if (validationResult.diagnostics.length > 0) {
          result.diagnostics.push({
            fileName: file.fileName,
            diagnostics: validationResult.diagnostics.map((diag) => ({
              line: diag.range.start.line + 1, // Convert to 1-based line numbers
              column: diag.range.start.character + 1, // Convert to 1-based column numbers
              message: diag.message,
              severity: diag.severity,
            })),
          });

          // Update overall success status
          result.success = result.success && validationResult.success;
        }

        // Store the AST if available and we don't have one yet
        if (validationResult.success && validationResult.ast && !result.ast) {
          result.ast = validationResult.ast;
          console.log(
            `IEC61131 Compiler Worker: AST generated successfully for ${file.fileName}`
          );
        }
      } catch (error) {
        console.error(
          `IEC61131 Compiler Worker: Compilation failed for ${file.fileName}:`,
          error
        );
        result.diagnostics.push({
          fileName: file.fileName,
          diagnostics: [
            {
              line: 1,
              column: 1,
              message: `Compilation error: ${
                error instanceof Error ? error.message : String(error)
              }`,
              severity: 'error',
            },
          ],
        });
        result.success = false;
      }
    }

    console.log(
      `IEC61131 Compiler Worker: Compilation complete. Success: ${result.success}`
    );

    // Send result back to main thread
    self.postMessage({
      type: 'compile-result',
      result,
    });
  } catch (error) {
    console.error(
      'IEC61131 Compiler Worker: Fatal error during compilation:',
      error
    );
    self.postMessage({
      type: 'compile-result',
      result: {
        success: false,
        diagnostics: [],
        fileCount: 0,
        error: `Compilation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } as CompilationResult,
    });
  }
};

// Export an empty object to make TypeScript happy
export {};
