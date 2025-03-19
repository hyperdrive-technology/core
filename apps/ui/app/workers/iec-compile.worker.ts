/// <reference lib="webworker" />

// Add this line at the top of the file
console.log('Worker initialized - checking imports');

import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser';

console.log('Imports loaded successfully');

import { validateIEC61131Document } from '../server/iec61131/langium-compiler';
import { startLanguageServer } from '../server/iec61131/language-server';

console.log('Language server import successful');

interface CompileFile {
  fileName: string;
  content: string;
}

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
  ast?: any; // The generated AST for deployment
  error?: string; // Add error property to interface
}

// Create a language connection
const connection = createConnection(
  new BrowserMessageReader(self as any),
  new BrowserMessageWriter(self as any)
);

// Initialize the language server with our connection
startLanguageServer(connection);

// Helper to convert diagnostics to our format
function convertDiagnostics(
  diagnostics: Array<{
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>
): CompilationDiagnostic[] {
  return diagnostics.map((diag) => ({
    line: diag.range.start.line + 1, // Convert to 1-based
    column: diag.range.start.character + 1, // Convert to 1-based
    message: diag.message,
    severity: diag.severity === 'error' ? 'error' : 'warning',
  }));
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, files } = event.data;

  if (type === 'compile') {
    console.log('Worker received message: compile');

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.error('No files to compile');
      self.postMessage({
        type: 'compile-result',
        result: {
          success: false,
          diagnostics: [],
          fileCount: 0,
          error: 'No files to compile',
        },
      });
      return;
    }

    console.log('Starting compilation of files:', files.length);

    const result: CompilationResult = {
      success: true,
      diagnostics: [],
      fileCount: files.length,
    };

    // Compile each file using our Langium validator
    try {
      // Process each file
      for (const file of files) {
        console.log(`Parsing file: ${file.fileName}`);

        // Use our Langium validator
        const validationResult = await validateIEC61131Document(file.content);

        // Add diagnostics to the result
        result.diagnostics.push({
          fileName: file.fileName,
          diagnostics: convertDiagnostics(validationResult.diagnostics),
        });

        // Check if there are errors
        if (!validationResult.success) {
          result.success = false;
          console.log(`Found errors in ${file.fileName}`);
        } else {
          // Store AST in result (for first successful file)
          if (!result.ast && validationResult.ast) {
            result.ast = validationResult.ast;
          }
        }
      }

      console.log(`Compilation complete. Success: ${result.success}`);
    } catch (error) {
      console.error('Error during compilation:', error);
      result.success = false;
      result.error = `Error during compilation: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }

    // Send result back to main thread
    self.postMessage({
      type: 'compile-result',
      result,
    });
  } else {
    console.warn('Worker received unknown message type:', type);
  }
});

// Required for TypeScript to recognize this as a module
export {};
