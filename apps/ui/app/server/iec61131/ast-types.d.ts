/**
 * Custom type definitions to fix issues with generated AST types
 */

import { AstNode } from 'langium';

// Fix for BinaryExpression by making it not extend all other expression types
interface BinaryExpression extends AstNode {
  readonly $type: 'BinaryExpression';
  left: Expression;
  operator: string;
  right: Expression;
}

// Override the generated interfaces
declare module './generated/grammar/ast' {
  interface BinaryExpression {
    readonly $type: 'BinaryExpression';
    left: Expression;
    operator: string;
    right: Expression;
  }
}
