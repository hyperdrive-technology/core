import { createAST } from './ast-builder';
import { tokenize } from './lexer';
import { AST } from './types';

export function parseIEC61131(code: string): AST {
  // 1. Tokenize the input
  const tokens = tokenize(code);

  // 2. Parse tokens into AST
  const ast = createAST(tokens);

  // 3. Validate AST
  validateAST(ast);

  return ast;
}

function validateAST(ast: AST): void {
  // Validate semantics, type checking, etc.
  // Throw errors if validation fails
}

// Export a function to serialize AST to JSON for sending to the server
export function serializeAST(ast: AST): string {
  return JSON.stringify(ast);
}
