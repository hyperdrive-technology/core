// Types
export interface CompilationFile {
  filePath: string;
  sourceCode: string;
  ast?: string;
}

export interface CompilationDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface CompilationResult {
  success: boolean;
  diagnostics: Array<{
    filePath: string;
    diagnostics: CompilationDiagnostic[];
  }>;
  fileCount: number;
  type?: string;
}

// Create a worker from code for browser compatibility
function createWorkerFromCode(code: string): Worker {
  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

// Worker script code for IEC-61131 validation using Langium principles
const workerScript = `
// Worker code for IEC-61131 compilation
self.addEventListener('message', (event) => {
  try {
    const request = event.data;

    if (request.type === 'compile') {
      console.log(\`[Langium Worker] Compiling \${request.files.length} files...\`);

      const result = compileIEC61131Files(request.files);
      self.postMessage(result);
    }
  } catch (error) {
    console.error('[Langium Worker] Error:', error);
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Let the main thread know the worker is ready
self.postMessage({ type: 'ready' });

// Simple validator for IEC-61131 code based on Langium principles
class IEC61131Validator {
  diagnostics = [];
  hasErrors = false;

  validateSyntax(sourceCode) {
    const lines = sourceCode.split('\\n');

    // Simple syntax checks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (line === '' || line.startsWith('//') || line.startsWith('(*')) {
        continue;
      }

      // Check for missing semicolons on assignment statements
      if (line.includes(':=') && !line.endsWith(';') && !line.includes('END_VAR') && !line.includes('END_FUNCTION')) {
        this.addDiagnostic('error', 'Missing semicolon at end of assignment statement', {
          start: { line: i, character: line.length },
          end: { line: i, character: line.length }
        });
      }

      // Check for unbalanced blocks
      if (line.match(/\\bFUNCTION\\b/) && !sourceCode.includes('END_FUNCTION')) {
        this.addDiagnostic('error', 'Missing END_FUNCTION statement', {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length }
        });
      }

      if (line.match(/\\bFUNCTION_BLOCK\\b/) && !sourceCode.includes('END_FUNCTION_BLOCK')) {
        this.addDiagnostic('error', 'Missing END_FUNCTION_BLOCK statement', {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length }
        });
      }

      if (line.match(/\\bPROGRAM\\b/) && !sourceCode.includes('END_PROGRAM')) {
        this.addDiagnostic('error', 'Missing END_PROGRAM statement', {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length }
        });
      }

      // Check for VAR blocks without END_VAR
      if (line.match(/\\bVAR(_INPUT|_OUTPUT|_IN_OUT|_EXTERNAL|_GLOBAL)?\\b/) && !sourceCode.includes('END_VAR')) {
        this.addDiagnostic('error', 'Missing END_VAR statement', {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length }
        });
      }

      // Check for IF statements without END_IF
      if (line.includes('IF') && line.includes('THEN') && !sourceCode.includes('END_IF')) {
        this.addDiagnostic('error', 'Missing END_IF statement', {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length }
        });
      }

      // Check for variables used without declaration
      if (line.includes(':=')) {
        const parts = line.split(':=');
        const variableName = parts[0].trim();

        // Check if this variable is declared somewhere in the code
        const varDeclPattern = new RegExp(\`\\\\b\${variableName}\\\\s*:\\\\s*\\\\w+\`, 'i');
        if (!varDeclPattern.test(sourceCode)) {
          this.addDiagnostic('warning', \`Variable '\${variableName}' might not be declared\`, {
            start: { line: i, character: 0 },
            end: { line: i, character: variableName.length }
          });
        }
      }
    }
  }

  addDiagnostic(severity, message, range) {
    this.diagnostics.push({
      severity,
      message,
      range
    });

    if (severity === 'error') {
      this.hasErrors = true;
    }
  }
}

/**
 * Generate a basic AST for an IEC-61131 file
 */
function generateAST(sourceCode, fileName) {
  // Extract program or function block name
  const programMatch = /PROGRAM\\s+(\\w+)/i.exec(sourceCode);
  const functionBlockMatch = /FUNCTION_BLOCK\\s+(\\w+)/i.exec(sourceCode);
  const functionMatch = /FUNCTION\\s+(\\w+)/i.exec(sourceCode);

  const name = programMatch?.[1] || functionBlockMatch?.[1] || functionMatch?.[1] || fileName.replace(/\\.st$/, '');

  // Create a basic AST object
  const ast = {
    type: programMatch ? 'Program' : functionBlockMatch ? 'FunctionBlock' : functionMatch ? 'Function' : 'Unknown',
    name: name,
    declarations: [],
    statements: [],
    content: sourceCode,
  };

  // Extract variable declarations using regex
  const varSections = sourceCode.match(/VAR(?:_INPUT|_OUTPUT|_IN_OUT|_EXTERNAL|_GLOBAL)?\\s+(.*?)END_VAR/gs) || [];

  for (const section of varSections) {
    const varLines = section.split('\\n').slice(1, -1); // Remove VAR and END_VAR lines

    for (const line of varLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('(*')) {
        continue;
      }

      const varMatch = trimmed.match(/(\\w+)\\s*:\\s*(\\w+)(?:\\s*:=\\s*([^;]+))?;/);
      if (varMatch) {
        const [_, name, type, initialValue] = varMatch;
        ast.declarations.push({
          type: 'VariableDeclaration',
          name,
          dataType: type,
          initialValue: initialValue || undefined
        });
      }
    }
  }

  return ast;
}

/**
 * Compile IEC-61131 structured text files
 */
function compileIEC61131Files(files) {
  const result = {
    type: 'compilation-result',
    success: true,
    diagnostics: [],
    fileCount: files.length
  };

  // Process each file and compile it
  for (const file of files) {
    const validator = new IEC61131Validator();
    validator.validateSyntax(file.sourceCode);

    // Add diagnostics to result
    result.diagnostics.push({
      filePath: file.filePath,
      diagnostics: validator.diagnostics
    });

    // Update success status
    if (validator.hasErrors) {
      result.success = false;
    }

    // Generate AST if not provided
    if (!file.ast) {
      try {
        file.ast = JSON.stringify(generateAST(file.sourceCode, file.filePath.split('/').pop() || 'unknown.st'));
      } catch (error) {
        console.error(\`Error generating AST for \${file.filePath}:\`, error);
        result.success = false;
        result.diagnostics.push({
          filePath: file.filePath,
          diagnostics: [{
            severity: 'error',
            message: \`Failed to generate AST: \${error instanceof Error ? error.message : String(error)}\`,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 }
            }
          }]
        });
      }
    }
  }

  return result;
}
`;

/**
 * Langium-based browser compiler for IEC-61131
 * Implements a browser-friendly version inspired by Langium principles
 */
export class LangiumBrowserCompiler {
  private worker: Worker | null = null;
  private ready = false;
  private callbacks = new Map<string, (result: CompilationResult) => void>();

  /**
   * Initialize the compiler
   */
  constructor() {}

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      return; // Already initialized
    }

    return new Promise<void>((resolve, reject) => {
      try {
        // Create the worker from the inline script
        this.worker = createWorkerFromCode(workerScript);

        // Set up message handling
        this.worker.addEventListener('message', (event) => {
          const response = event.data;

          if (response.type === 'ready') {
            console.log('Langium IEC-61131 Compiler Worker ready');
            this.ready = true;
            resolve();
          } else if (
            response.type === 'compilation-result' ||
            response.type === undefined
          ) {
            // Find and call the callback for this compilation
            // Use the first callback in the map since we only have one active compilation at a time
            const callbackEntries = Array.from(this.callbacks.entries());
            if (callbackEntries.length > 0) {
              const [callbackId, callback] = callbackEntries[0];
              callback(response as CompilationResult);
              this.callbacks.delete(callbackId);
            } else {
              console.warn('Received compilation result but no callback found');
            }
          } else if (response.type === 'error') {
            console.error('Worker error:', response.error);
            reject(new Error(response.error));
          }
        });

        // Handle worker errors
        this.worker.addEventListener('error', (error) => {
          console.error('Worker error:', error);
          this.ready = false;
          reject(error);
        });
      } catch (error) {
        console.error('Failed to initialize Langium compiler worker:', error);
        reject(error);
      }
    });
  }

  /**
   * Compile IEC-61131 files in the browser
   * @param files Array of files to compile
   * @returns Promise resolving to compilation result
   */
  async compile(files: CompilationFile[]): Promise<CompilationResult> {
    // Make sure the worker is initialized
    if (!this.worker || !this.ready) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('Failed to initialize Langium compiler worker');
    }

    return new Promise<CompilationResult>((resolve, reject) => {
      try {
        // Generate a unique ID for this compilation request
        const callbackId = `compile-${Date.now()}`;

        // Store the callback
        this.callbacks.set(callbackId, resolve);

        // Send the compilation request to the worker
        const request = {
          type: 'compile',
          files,
        };

        // We're sure the worker exists here because we checked above and would have thrown
        const worker = this.worker as Worker;
        worker.postMessage(request);

        // Set a timeout to avoid hanging if the worker doesn't respond
        setTimeout(() => {
          if (this.callbacks.has(callbackId)) {
            this.callbacks.delete(callbackId);
            reject(new Error('Compilation request timed out'));
          }
        }, 10000); // 10 second timeout
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Compile a single IEC-61131 file
   * @param filePath Path to the file
   * @param sourceCode Source code content
   * @returns Promise resolving to compilation result
   */
  async compileSingle(
    filePath: string,
    sourceCode: string
  ): Promise<CompilationResult> {
    return this.compile([{ filePath, sourceCode }]);
  }

  /**
   * Terminate the worker when done
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}
