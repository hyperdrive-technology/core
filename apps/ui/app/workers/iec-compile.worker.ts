/// <reference lib="webworker" />

// Add this line at the top of the file
console.log('Worker initialized - checking imports');

import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/browser';

console.log('Imports loaded successfully');

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

// Create a simple language worker
const connection = createConnection(
  new BrowserMessageReader(self as any),
  new BrowserMessageWriter(self as any)
);

// Initialize the language server with our connection
startLanguageServer(connection);

// Helper to convert LSP diagnostics to our format
function convertDiagnostics(
  diagnostics: Diagnostic[]
): CompilationDiagnostic[] {
  return diagnostics.map((diag) => ({
    line: diag.range.start.line + 1, // Convert to 1-based
    column: diag.range.start.character + 1, // Convert to 1-based
    message: diag.message,
    severity: diag.severity === DiagnosticSeverity.Error ? 'error' : 'warning',
  }));
}

// Generate a simple AST for a structured text file
function generateAST(content: string, fileName: string): any {
  try {
    const lines = content.split(/\r?\n/);
    const ast: any = {
      type: 'Program',
      fileName,
      body: [],
      variables: extractVariables(content),
    };

    // Extract program structure
    let currentBlock: any = null;
    let inVarBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (line === '' || line.startsWith('//') || line.startsWith('(*')) {
        continue;
      }

      // Check for program/function/function block declarations
      if (/^PROGRAM\s+([A-Za-z0-9_]+)/i.test(line)) {
        const match = line.match(/^PROGRAM\s+([A-Za-z0-9_]+)/i);
        if (match) {
          currentBlock = {
            type: 'Program',
            name: match[1],
            statements: [],
          };
          ast.body.push(currentBlock);
        }
      } else if (/^FUNCTION\s+([A-Za-z0-9_]+)\s*:/i.test(line)) {
        const match = line.match(/^FUNCTION\s+([A-Za-z0-9_]+)\s*:/i);
        if (match) {
          currentBlock = {
            type: 'Function',
            name: match[1],
            statements: [],
          };
          ast.body.push(currentBlock);
        }
      } else if (/^FUNCTION_BLOCK\s+([A-Za-z0-9_]+)/i.test(line)) {
        const match = line.match(/^FUNCTION_BLOCK\s+([A-Za-z0-9_]+)/i);
        if (match) {
          currentBlock = {
            type: 'FunctionBlock',
            name: match[1],
            statements: [],
          };
          ast.body.push(currentBlock);
        }
      }
      // Check for variable blocks
      else if (/^VAR/i.test(line)) {
        inVarBlock = true;
      } else if (/^END_VAR/i.test(line)) {
        inVarBlock = false;
      }
      // Simple statement capture inside program blocks
      else if (currentBlock && !inVarBlock) {
        // This is a very simplified representation of statements
        currentBlock.statements.push({
          type: 'Statement',
          text: line,
        });
      }
    }

    return ast;
  } catch (error) {
    console.error('Error generating AST:', error);
    return {
      type: 'Program',
      fileName,
      error: 'Failed to generate AST',
      errorDetails: error instanceof Error ? error.message : String(error),
    };
  }
}

// Extract variables from the content using regex
function extractVariables(content: string): any[] {
  const variables = [];
  const varBlockRegex =
    /VAR(?:_INPUT|_OUTPUT|_IN_OUT|_TEMP|_EXTERNAL|_GLOBAL)?\s*(.*?)END_VAR/gis;
  const varDeclarationRegex =
    /\s*([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)(?:\s*:=\s*([^;]+))?;?/gi;

  let varBlockMatch;
  while ((varBlockMatch = varBlockRegex.exec(content)) !== null) {
    const varBlock = varBlockMatch[1];
    let varMatch;

    while ((varMatch = varDeclarationRegex.exec(varBlock)) !== null) {
      variables.push({
        name: varMatch[1],
        type: varMatch[2],
        initialValue: varMatch[3] ? varMatch[3].trim() : undefined,
      });
    }
  }

  return variables;
}

// Basic validation function that checks for common IEC 61131-3 syntax issues
function validateIEC61131(text: string): Diagnostic[] {
  console.log('Validating IEC-61131 code, length:', text.length);
  try {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split(/\r?\n/);
    console.log('Code split into', lines.length, 'lines');

    // Check for basic syntax issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and comments
      if (
        line.trim() === '' ||
        line.trim().startsWith('//') ||
        line.trim().startsWith('(*')
      ) {
        continue;
      }

      // Check for missing semicolons
      if (shouldHaveSemicolon(line) && !line.trim().endsWith(';')) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: i, character: line.length },
            end: { line: i, character: line.length },
          },
          message: 'Missing semicolon at end of statement',
          source: 'iec61131-validator',
        });
      }

      // Check for unbalanced blocks
      checkUnbalancedBlocks(line, i, diagnostics);
    }

    console.log('Validation complete, found', diagnostics.length, 'issues');

    // Log detailed diagnostics for debugging
    if (diagnostics.length > 0) {
      console.log('Validation errors found:');
      diagnostics.slice(0, 10).forEach((diag, idx) => {
        console.log(
          `Error ${idx + 1}: Line ${diag.range.start.line + 1} - ${
            diag.message
          }`
        );
      });
      if (diagnostics.length > 10) {
        console.log(`...and ${diagnostics.length - 10} more errors`);
      }
    }

    // Check for cross-references across files (would be more complex in a real implementation)
    return diagnostics;
  } catch (error) {
    console.error('Error during validation:', error);
    return [
      {
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: `Validation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        source: 'iec61131-validator',
      },
    ];
  }
}

// Check for unbalanced blocks in the code
function checkUnbalancedBlocks(
  line: string,
  lineIndex: number,
  diagnostics: Diagnostic[]
) {
  const trimmed = line.trim();

  // Simple checks for structure keywords
  if (/\bFUNCTION\b/i.test(trimmed) && !/\bEND_FUNCTION\b/i.test(trimmed)) {
    // This is just an example - in a real validator, you'd track the opening and closing of blocks
    if (!trimmed.match(/\w+\s*:/)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        message:
          'FUNCTION declaration must include a return type (FUNCTION name : type)',
        source: 'iec61131-validator',
      });
    }
  }
}

// Helper function to determine if a line should have a semicolon
function shouldHaveSemicolon(line: string): boolean {
  // Trim the line and remove any existing semicolon
  const trimmed = line.trim().replace(/;$/, '');

  // Lines that shouldn't have semicolons
  if (
    /\b(IF|THEN|ELSE|END_IF|FUNCTION|END_FUNCTION|FUNCTION_BLOCK|END_FUNCTION_BLOCK|PROGRAM|END_PROGRAM|VAR|END_VAR)\b/i.test(
      trimmed
    ) ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('(*') ||
    trimmed.endsWith('*)') ||
    trimmed === ''
  ) {
    return false;
  }

  // Everything else should have a semicolon
  return true;
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

    // Compile each file
    for (const file of files) {
      console.log('Compiling file:', file.fileName);

      // Validate code
      const diagnostics = validateIEC61131(file.content);

      // Add to result
      result.diagnostics.push({
        fileName: file.fileName,
        diagnostics: convertDiagnostics(diagnostics),
      });

      // Check if there are errors
      const hasErrors = diagnostics.some(
        (d) => d.severity === DiagnosticSeverity.Error
      );

      if (hasErrors) {
        result.success = false;
        console.log(
          `Found ${diagnostics.length} errors, skipping AST generation`
        );

        // Log detailed errors for this file
        console.log(`Detailed errors in ${file.fileName}:`);
        diagnostics.slice(0, 15).forEach((diag, idx) => {
          console.log(
            `  Error ${idx + 1}: Line ${diag.range.start.line + 1} - ${
              diag.message
            }`
          );
        });
      } else {
        // Only generate AST for successful compilations
        try {
          console.log('Generating AST...');
          result.ast = generateAST(file.content, file.fileName);
          console.log('AST generation complete');
        } catch (error) {
          console.error('Error generating AST:', error);
          result.success = false;
          result.error = `Error generating AST: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }
    }

    // Send result back to main thread
    console.log('Compilation complete. Success:', result.success);
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
