// Common types shared between client and server

export type DataType =
  | 'BOOL'
  | 'INT'
  | 'DINT'
  | 'REAL'
  | 'STRING'
  | 'TIME'
  | 'DATE'
  | 'ARRAY'
  | 'STRUCT';

export type POUType = 'PROGRAM' | 'FUNCTION_BLOCK' | 'FUNCTION';

export interface Variable {
  name: string;
  dataType: DataType;
  initialValue?: any;
  arrayDimensions?: [number, number][];
  structType?: string;
}

export interface VariableBlock {
  type: 'VAR' | 'VAR_INPUT' | 'VAR_OUTPUT' | 'VAR_IN_OUT' | 'VAR_EXTERNAL' | 'VAR_TEMP';
  variables: Variable[];
}

export interface Statement {
  type: string;
  // Common properties for all statements
  [key: string]: any;
}

export interface AssignmentStatement extends Statement {
  type: 'ASSIGNMENT';
  target: Expression;
  value: Expression;
}

export interface IfStatement extends Statement {
  type: 'IF';
  condition: Expression;
  thenStatements: Statement[];
  elseIfClauses: {
    condition: Expression;
    statements: Statement[];
  }[];
  elseStatements: Statement[];
}

// More statement types...

export interface Expression {
  type: string;
  dataType?: DataType;
  // Common properties for all expressions
  [key: string]: any;
}

export interface BinaryExpression extends Expression {
  type: 'BINARY_OPERATION';
  operator: '+' | '-' | '*' | '/' | 'AND' | 'OR' | '=' | '<>' | '<' | '>' | '<=' | '>=';
  left: Expression;
  right: Expression;
}

// More expression types...

export interface ProgramOrganizationUnit {
  type: POUType;
  name: string;
  returnType?: DataType;
  variables: VariableBlock[];
  body: Statement[];
}

export interface AST {
  programs: ProgramOrganizationUnit[];
  functionBlocks: ProgramOrganizationUnit[];
  functions: ProgramOrganizationUnit[];
}
