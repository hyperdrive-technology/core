interface IECCompilerResult {
  diagnostics: Array<{
    severity: 'error' | 'warning';
    message: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
  ast?: any;
  success: boolean;
}

/**
 * Directly parse IEC 61131-3 code without using Langium services
 */
function parseIEC61131(content: string): {
  ast: {
    type: string;
    programs: Array<{
      name: string;
      type: string;
      range: { start: number; end: number };
    }>;
    functionBlocks: Array<{
      name: string;
      type: string;
      range: { start: number; end: number };
    }>;
    functions: Array<{
      name: string;
      type: string;
      range: { start: number; end: number };
    }>;
    content: string;
  } | null;
  diagnostics: Array<{
    severity: 'error' | 'warning';
    message: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
} {
  // Find syntax errors
  const errors = findBasicSyntaxErrors(content);

  // Convert parser errors to diagnostics
  const diagnostics = errors.map((error) => {
    // Calculate line and column
    const contentBefore = content.substring(0, error.position);
    const lines = contentBefore.split('\n');
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;

    return {
      severity: 'error' as const,
      message: error.message,
      range: {
        start: { line, character: column },
        end: { line, character: column + 1 },
      },
    };
  });

  // If there are errors, return null AST
  if (errors.length > 0) {
    return {
      ast: null,
      diagnostics,
    };
  }

  // Create a minimal AST
  const ast = createMinimalAST(content);

  return {
    ast,
    diagnostics,
  };
}

// Simple syntax check for IEC 61131
function findBasicSyntaxErrors(content: string) {
  const errors = [];

  // Check for unbalanced blocks
  const blocks = [
    {
      start: /\bFUNCTION_BLOCK\b/i,
      end: /\bEND_FUNCTION_BLOCK\b/i,
      name: 'FUNCTION_BLOCK',
    },
    { start: /\bPROGRAM\b/i, end: /\bEND_PROGRAM\b/i, name: 'PROGRAM' },
    { start: /\bFUNCTION\b/i, end: /\bEND_FUNCTION\b/i, name: 'FUNCTION' },
    { start: /\bIF\b.*\bTHEN\b/i, end: /\bEND_IF\b/i, name: 'IF' },
    {
      start:
        /\b(VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_EXTERNAL|VAR_GLOBAL|VAR_TEMP)\b/i,
      end: /\bEND_VAR\b/i,
      name: 'VAR',
    },
  ];

  for (const block of blocks) {
    const startMatches = content.match(new RegExp(block.start, 'g')) || [];
    const endMatches = content.match(new RegExp(block.end, 'g')) || [];

    if (startMatches.length > endMatches.length) {
      errors.push({
        message: `Missing ${block.end
          .toString()
          .replace(/\\b|\(|\)|\//g, '')} for ${block.name}`,
        position: content.search(block.start),
      });
    } else if (startMatches.length < endMatches.length) {
      errors.push({
        message: `Extra ${block.end
          .toString()
          .replace(/\\b|\(|\)|\//g, '')} without matching ${block.name}`,
        position: content.search(block.end),
      });
    }
  }

  return errors;
}

// Create a minimal AST for IEC 61131-3 code
function createMinimalAST(content: string) {
  // Extract program and function block names
  const programs = [];
  const functionBlocks = [];
  const functions = [];

  // Find PROGRAM declarations
  const programMatches = content.matchAll(
    /PROGRAM\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
  );
  for (const match of programMatches) {
    if (match[1]) {
      programs.push({
        name: match[1],
        type: 'Program',
        range: {
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
        },
      });
    }
  }

  // Find FUNCTION_BLOCK declarations
  const fbMatches = content.matchAll(
    /FUNCTION_BLOCK\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
  );
  for (const match of fbMatches) {
    if (match[1]) {
      functionBlocks.push({
        name: match[1],
        type: 'FunctionBlock',
        range: {
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
        },
      });
    }
  }

  // Find FUNCTION declarations
  const funcMatches = content.matchAll(/FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of funcMatches) {
    if (match[1]) {
      functions.push({
        name: match[1],
        type: 'Function',
        range: {
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
        },
      });
    }
  }

  return {
    type: 'Model',
    programs,
    functionBlocks,
    functions,
    content: content, // Keep the original content for reference
  };
}

/**
 * IEC 61131-3 validator with semantic rules
 */
class IEC61131Validator {
  validateAST(ast: any): Array<{
    severity: 'error' | 'warning';
    message: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }> {
    const diagnostics: Array<{
      severity: 'error' | 'warning';
      message: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    }> = [];

    // Validate the AST
    if (!ast) {
      return [
        {
          severity: 'error' as const,
          message: 'Invalid AST',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
      ];
    }

    // Check for required elements
    if (
      ast.programs.length === 0 &&
      ast.functionBlocks.length === 0 &&
      ast.functions.length === 0
    ) {
      diagnostics.push({
        severity: 'error' as const,
        message:
          'File must contain at least one PROGRAM, FUNCTION, or FUNCTION_BLOCK',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
      });
    }

    // Check for duplicate names
    const names = new Set<string>();
    const allDeclarations = [
      ...ast.programs,
      ...ast.functionBlocks,
      ...ast.functions,
    ];

    for (const decl of allDeclarations) {
      if (names.has(decl.name)) {
        // Find position in content
        const pos = ast.content.indexOf(decl.name, decl.range.start);
        const linesBefore = ast.content.substring(0, pos).split('\n');
        const line = linesBefore.length - 1;
        const column = linesBefore[linesBefore.length - 1].length;

        diagnostics.push({
          severity: 'error' as const,
          message: `Duplicate name: ${decl.name}`,
          range: {
            start: { line, character: column },
            end: { line, character: column + decl.name.length },
          },
        });
      }
      names.add(decl.name);
    }

    return diagnostics;
  }
}

/**
 * Parse and validate an IEC 61131-3 document
 */
export function validateIEC61131Document(
  iec61131Code: string
): IECCompilerResult {
  try {
    // Parse the document
    const { ast, diagnostics: parserDiagnostics } = parseIEC61131(iec61131Code);

    // Validate the AST if parsing was successful
    const validator = new IEC61131Validator();
    const validatorDiagnostics = validator.validateAST(ast);

    // Combine diagnostics from parser and validator
    const diagnostics = [...parserDiagnostics, ...validatorDiagnostics];

    return {
      success: diagnostics.filter((d) => d.severity === 'error').length === 0,
      ast,
      diagnostics,
    };
  } catch (error) {
    console.error('Error validating IEC61131 document:', error);
    return {
      success: false,
      ast: null,
      diagnostics: [
        {
          severity: 'error' as const,
          message: `Error during compilation: ${
            error instanceof Error ? error.message : String(error)
          }`,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
      ],
    };
  }
}

/**
 * Create a scope provider for resolving cross-references
 * This would be expanded to handle all cross-reference types
 */
class IEC61131ScopeProvider {
  getScope(context: any): any {
    // Example implementation for resolving variable references
    // This would need to be expanded based on your grammar
    if (context.property === 'variable') {
      // Find all variables that could be referenced here
      const container = context.container;
      const model = this.findRootNode(container);

      // Return a scope with all visible variables
      return {
        getElement: (name: string) => this.findVariableByName(model, name),
        getAllElements: () => this.getAllVariables(model),
      };
    }

    // Return empty scope for other references
    return {
      getElement: () => undefined,
      getAllElements: () => [],
    };
  }

  findRootNode(node: any): any {
    // Traverse up to find the root node
    let current = node;
    while (current.$container) {
      current = current.$container;
    }
    return current;
  }

  findVariableByName(model: any, name: string): any {
    // Implementation would search for a variable by name
    return undefined;
  }

  getAllVariables(model: any): any[] {
    // Implementation would return all variables
    return [];
  }
}
