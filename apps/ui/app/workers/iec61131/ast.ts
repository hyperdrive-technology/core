export interface AstNode {
  readonly $type: string;
}

export interface Reference<T> {
  ref: T;
}

export type BinaryOperator =
  | 'OR'
  | 'XOR'
  | 'AND'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | 'MOD';

export type UnaryOperator = 'NOT' | '-';

export type Expression =
  | UnaryExpression
  | BinaryExpression
  | FunctionCallExpression
  | Literal
  | ParenExpression
  | VariableReference
  | EnumReference
  | ArrayAccess
  | ArrayInitializer;

export type PrimaryExpression =
  | FunctionCallExpression
  | Literal
  | ParenExpression
  | VariableReference;

export type Statement =
  | Assignment
  | CaseStatement
  | ForStatement
  | FunctionCall
  | IfStatement
  | RepeatStatement
  | ReturnStatement
  | TypeDeclaration
  | WhileStatement;

export type TypeDecl = ArrayType | EnumTypeReference | SimpleType | StructType;

export interface Argument extends AstNode {
  readonly $type: 'Argument';
  name?: string;
  value: Expression;
}

export interface ArrayDimension extends AstNode {
  readonly $type: 'ArrayDimension';
  start: number | string;
  end: number | string;
}

export interface ArrayType extends AstNode {
  readonly $type: 'ArrayType';
  dimensions: ArrayDimension[];
  type: TypeDecl;
}

export interface Assignment extends AstNode {
  readonly $type: 'Assignment';
  target: LeftExpression;
  value: Expression;
}

export interface BinaryExpression extends AstNode {
  readonly $type: 'BinaryExpression';
  left: PrimaryExpression;
  operator: BinaryOperator;
  right: Expression;
}

export interface Call extends AstNode {
  readonly $type: 'Call';
  args: Argument[];
  func?: Reference<FunctionDef>;
  variable?: Reference<VariableDecl>;
  object?: string;
  member?: string;
}

export interface CaseStatement extends AstNode {
  readonly $type: 'CaseStatement';
  expression: Expression;
  caseLabels: Expression[];
  caseStatements: Statement[];
  defaultStatements: Statement[];
}

export interface ElementAccess extends AstNode {
  readonly $type: 'ElementAccess';
  member: string;
  index?: Expression;
}

export interface EnumType extends AstNode {
  readonly $type: 'EnumType';
  name: string;
  enumValues: EnumValue[];
}

export interface EnumTypeReference extends AstNode {
  readonly $type: 'EnumTypeReference';
  type: Reference<EnumType>;
}

export interface EnumValue extends AstNode {
  readonly $type: 'EnumValue';
  name: string;
  value?: number;
}

export interface ForStatement extends AstNode {
  readonly $type: 'ForStatement';
  variable: string;
  start: Expression;
  end: Expression;
  step?: Expression;
  statements: Statement[];
}

export interface FunctionBlock extends AstNode {
  readonly $type: 'FunctionBlock';
  name: string;
  varDeclarations: VarDeclaration[];
  body: ProgramBody;
}

export interface FunctionCall extends AstNode {
  readonly $type: 'FunctionCall';
  call: Call;
}

export interface FunctionCallExpression extends AstNode {
  readonly $type: 'FunctionCallExpression';
  call: Call;
}

export interface FunctionDef extends AstNode {
  readonly $type: 'FunctionDef';
  name: string;
  returnType: TypeDecl;
  varDeclarations: VarDeclaration[];
  innerTypes?: TypeDeclaration[];
  body: ProgramBody;
}

export interface IfStatement extends AstNode {
  readonly $type: 'IfStatement';
  condition: Expression;
  thenStatements: Statement[];
  elseIfConditions: Expression[];
  elseIfStatements: Statement[];
  elseStatements: Statement[];
}

export interface LeftExpression extends AstNode {
  readonly $type: 'LeftExpression';
  elements: ElementAccess[];
}

export interface Literal extends AstNode {
  readonly $type: 'Literal';
  value: boolean | number | string;
}

export interface ParenExpression extends AstNode {
  readonly $type: 'ParenExpression';
  expr: Expression;
}

export interface Program extends AstNode {
  readonly $type: 'Program';
  enumTypes: EnumType[];
  structTypes: StructType[];
  functionBlocks: FunctionBlock[];
  functions: FunctionDef[];
  programs: ProgramDecl[];
}

export interface ProgramBody extends AstNode {
  readonly $type: 'ProgramBody';
  statements: Statement[];
}

export interface ProgramDecl extends AstNode {
  readonly $type: 'ProgramDecl';
  name: string;
  varDeclarations: VarDeclaration[];
  body: ProgramBody;
}

export interface RepeatStatement extends AstNode {
  readonly $type: 'RepeatStatement';
  statements: Statement[];
  condition: Expression;
}

export interface ReturnStatement extends AstNode {
  readonly $type: 'ReturnStatement';
  value?: Expression;
}

export interface SimpleType extends AstNode {
  readonly $type: 'SimpleType';
  name: string;
  rangeConstraint?: {
    start: Expression;
    end: Expression;
  };
}

export interface StructMember extends AstNode {
  readonly $type: 'StructMember';
  name: string;
  type: TypeDecl;
  initialValue?: Expression;
}

export interface StructType extends AstNode {
  readonly $type: 'StructType';
  name: string;
  members: StructMember[];
}

export interface UnaryExpression extends AstNode {
  readonly $type: 'UnaryExpression';
  operator: UnaryOperator;
  operand: PrimaryExpression;
}

export interface VarDeclaration extends AstNode {
  readonly $type: 'VarDeclaration';
  variables: VariableDecl[];
}

export interface VariableDecl extends AstNode {
  readonly $type: 'VariableDecl';
  name: string;
  type: TypeDecl;
  initialValue?: Expression;
}

export interface VariableReference extends AstNode {
  readonly $type: 'VariableReference';
  elements: ElementAccess[];
}

export interface WhileStatement extends AstNode {
  readonly $type: 'WhileStatement';
  condition: Expression;
  statements: Statement[];
}

export interface EnumReference extends AstNode {
  readonly $type: 'EnumReference';
  value: string;
}

export interface ArrayAccess extends AstNode {
  readonly $type: 'ArrayAccess';
  array: VariableReference;
  index: Expression;
}

export interface ArrayInitializer extends AstNode {
  readonly $type: 'ArrayInitializer';
  elements: Expression[];
}

export interface TypeDeclaration extends AstNode {
  readonly $type: 'TypeDeclaration';
  name: string;
  dataType?: SimpleType;
  initialValue?: Expression;
}
