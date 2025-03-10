grammar IEC61131

entry Program:
    (functions+=FunctionDef | functionBlocks+=FunctionBlock | programs+=ProgramDecl | enumTypes+=EnumType)*;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\(\*[\s\S]*?\*\)/;
hidden terminal SL_COMMENT: /\/\/[^\n]*/;

// Define tokens in order of length (longest first)
// Keywords with prefixes
terminal FUNCTION_BLOCK: 'FUNCTION_BLOCK';
terminal END_FUNCTION_BLOCK: 'END_FUNCTION_BLOCK';
terminal VAR_INPUT: 'VAR_INPUT';
terminal VAR_OUTPUT: 'VAR_OUTPUT';
terminal VAR_IN_OUT: 'VAR_IN_OUT';
terminal VAR_EXTERNAL: 'VAR_EXTERNAL';
terminal VAR_GLOBAL: 'VAR_GLOBAL';
terminal VAR_TEMP: 'VAR_TEMP';
terminal END_PROGRAM: 'END_PROGRAM';
terminal END_FUNCTION: 'END_FUNCTION';
terminal END_WHILE: 'END_WHILE';
terminal END_REPEAT: 'END_REPEAT';
terminal END_STRUCT: 'END_STRUCT';
terminal END_IF: 'END_IF';
terminal END_FOR: 'END_FOR';
terminal END_VAR: 'END_VAR';
terminal END_CASE: 'END_CASE';

// Basic keywords
terminal FUNCTION: 'FUNCTION';
terminal PROGRAM: 'PROGRAM';
terminal REPEAT: 'REPEAT';
terminal STRUCT: 'STRUCT';
terminal WHILE: 'WHILE';
terminal ARRAY: 'ARRAY';
terminal BEGIN: 'BEGIN';
terminal ELSIF: 'ELSIF';
terminal UNTIL: 'UNTIL';
terminal ELSE: 'ELSE';
terminal THEN: 'THEN';
terminal CONSTANT: 'CONSTANT';
terminal RETAIN: 'RETAIN';
terminal VAR: 'VAR';
terminal FOR: 'FOR';
terminal END: 'END';
terminal IF: 'IF';
terminal OF: 'OF';
terminal TO: 'TO';
terminal BY: 'BY';
terminal DO: 'DO';
terminal CASE: 'CASE';
terminal RETURN: 'RETURN';

// Data types (will be highlighted as types)
terminal BOOL: 'BOOL';
terminal BYTE: 'BYTE';
terminal WORD: 'WORD';
terminal DWORD: 'DWORD';
terminal LWORD: 'LWORD';
terminal SINT: 'SINT';
terminal INT: 'INT';
terminal DINT: 'DINT';
terminal LINT: 'LINT';
terminal USINT: 'USINT';
terminal UINT: 'UINT';
terminal UDINT: 'UDINT';
terminal ULINT: 'ULINT';
terminal REAL: 'REAL';
terminal LREAL: 'LREAL';
terminal TIME: 'TIME';
terminal DATE: 'DATE';
terminal TOD: 'TOD';
terminal DT: 'DT';
terminal STRING_TYPE: 'STRING';
terminal WSTRING: 'WSTRING';
terminal CHAR: 'CHAR';
terminal WCHAR: 'WCHAR';
terminal TON: 'TON';
terminal TOF: 'TOF';
terminal TP: 'TP';

// Constants (will be highlighted as constants)
terminal TRUE: 'TRUE';
terminal FALSE: 'FALSE';
terminal NULL: 'NULL';

// Operators
terminal AND: 'AND';
terminal OR: 'OR';
terminal XOR: 'XOR';
terminal NOT: 'NOT';
terminal MOD: 'MOD';

// Built-in functions (will be highlighted as functions)
terminal ABS: 'ABS';
terminal SQRT: 'SQRT';
terminal LN: 'LN';
terminal LOG: 'LOG';
terminal EXP: 'EXP';
terminal SIN: 'SIN';
terminal COS: 'COS';
terminal TAN: 'TAN';
terminal ASIN: 'ASIN';
terminal ACOS: 'ACOS';
terminal ATAN: 'ATAN';
terminal MIN: 'MIN';
terminal MAX: 'MAX';
terminal LIMIT: 'LIMIT';
terminal LEN: 'LEN';
terminal LEFT: 'LEFT';
terminal RIGHT: 'RIGHT';
terminal MID: 'MID';
terminal CONCAT: 'CONCAT';
terminal INSERT: 'INSERT';
terminal DELETE: 'DELETE';
terminal REPLACE: 'REPLACE';
terminal FIND: 'FIND';
terminal TIME_TO_REAL: 'TIME_TO_REAL';

// Special number formats
terminal HEX_NUMBER: /16#[0-9A-Fa-f]+/;
terminal BIN_NUMBER: /2#[01]+/;
terminal OCT_NUMBER: /8#[0-7]+/;
terminal TIME_LITERAL: /T#[0-9smhd_]+/;
terminal DATE_LITERAL: /D#\d{4}-\d{1,2}-\d{1,2}/;

// Regular identifiers, numbers and strings
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal NUMBER returns number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
terminal STRING: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/;

// Symbols - order matters! Longer tokens must come before shorter ones
terminal LESS_EQUAL: '<=';
terminal GREATER_EQUAL: '>=';
terminal NOT_EQUAL: '<>';
terminal ASSIGN: ':=';
terminal INIT: '=>';
terminal RANGE: '..';
terminal EQUAL: '=';
terminal LESS: '<';
terminal GREATER: '>';
terminal PLUS: '+';
terminal MINUS: '-';
terminal MULTIPLY: '*';
terminal DIVIDE: '/';
terminal DOT: '.';
terminal COMMA: ',';
terminal SEMICOLON: ';';
terminal COLON: ':';
terminal LPAREN: '(';
terminal RPAREN: ')';
terminal LBRACKET: '[';
terminal RBRACKET: ']';

// Define grammar rules
ProgramDecl:
    PROGRAM name=ID
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    END_PROGRAM;

FunctionDef:
    FUNCTION name=ID COLON returnType=TypeDecl
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    END_FUNCTION;

FunctionBlock:
    FUNCTION_BLOCK name=ID
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    END_FUNCTION_BLOCK;

ProgramBody:
    BEGIN
    statements+=Statement*
    END;

VarDeclaration:
    (
        VAR |
        VAR_INPUT |
        VAR_OUTPUT |
        VAR_IN_OUT |
        VAR_TEMP |
        VAR_EXTERNAL |
        VAR_GLOBAL
    )
    (CONSTANT | RETAIN)?  // Optional modifiers
    variables+=VariableDecl (SEMICOLON variables+=VariableDecl)*
    END_VAR;

VariableDecl:
    name=ID COLON type=TypeDecl (INIT initialValue=Expression)?;

TypeDecl:
    ArrayType | StructType | SimpleType | EnumTypeReference;

ArrayType:
    ARRAY LBRACKET dimensions+=ArrayDimension (COMMA dimensions+=ArrayDimension)* RBRACKET OF type=TypeDecl;

ArrayDimension:
    start=(NUMBER|HEX_NUMBER|BIN_NUMBER) RANGE end=(NUMBER|HEX_NUMBER|BIN_NUMBER);

StructType:
    STRUCT
    fields+=VariableDecl (SEMICOLON fields+=VariableDecl)*
    END_STRUCT;

SimpleType:
    name=ID;

EnumType:
    'TYPE' name=ID COLON LPAREN
        enumValues+=EnumValue (COMMA enumValues+=EnumValue)*
    RPAREN SEMICOLON 'END_TYPE';

EnumValue:
    name=ID (ASSIGN value=NUMBER)?;

EnumTypeReference:
    type=[EnumType:ID];

Statement:
    Assignment | IfStatement | WhileStatement | RepeatStatement | ForStatement | FunctionCall | CaseStatement | ReturnStatement;

Assignment:
    target=LeftExpression ASSIGN value=Expression SEMICOLON;

LeftExpression:
    elements+=ElementAccess (DOT elements+=ElementAccess)*;

ElementAccess:
    member=ID (LBRACKET index=Expression RBRACKET)?;

// Add this new rule for common function call structure
Call:
    (func=[FunctionDef:ID] | variable=[VariableDecl:ID])
    LPAREN (args+=Argument (COMMA args+=Argument)*)? RPAREN;

// Update FunctionCall to use the common Call rule
FunctionCall:
    call=Call SEMICOLON;

Argument:
    (name=ID ASSIGN)? value=Expression;

IfStatement:
    IF condition=Expression THEN
    thenStatements+=Statement*
    (ELSIF elseIfConditions+=Expression THEN elseIfStatements+=Statement*)*
    (ELSE elseStatements+=Statement*)?
    END_IF;

WhileStatement:
    WHILE condition=Expression DO
    statements+=Statement*
    END_WHILE;

RepeatStatement:
    REPEAT
    statements+=Statement*
    UNTIL condition=Expression
    END_REPEAT;

ForStatement:
    FOR variable=ID ASSIGN start=Expression TO end=Expression (BY step=Expression)? DO
    statements+=Statement*
    END_FOR;

CaseStatement:
    CASE expression=Expression OF
    (caseLabels+=Expression COLON caseStatements+=Statement*)*
    (ELSE defaultStatements+=Statement*)?
    END_CASE;

ReturnStatement:
    RETURN (value=Expression)? SEMICOLON;

// Completely flattened expression hierarchy without circular references
Expression:
    {infer BinaryExpression} left=PrimaryExpression operator=BinaryOperator right=Expression |
    {infer UnaryExpression} operator=UnaryOperator operand=PrimaryExpression |
    PrimaryExpression;

PrimaryExpression:
    {infer ParenExpression} LPAREN expr=Expression RPAREN |
    {infer Literal} value=(NUMBER | HEX_NUMBER | BIN_NUMBER | OCT_NUMBER | TIME_LITERAL | DATE_LITERAL | STRING | BoolLiteral) |
    {infer FunctionCallExpression} call=Call |
    {infer VariableReference} elements+=ElementAccess (DOT elements+=ElementAccess)*;

BinaryOperator returns string:
    OR | XOR | AND | EQUAL | NOT_EQUAL |
    LESS | LESS_EQUAL | GREATER | GREATER_EQUAL |
    PLUS | MINUS | MULTIPLY | DIVIDE | MOD;

UnaryOperator returns string:
    NOT | MINUS;

BoolLiteral returns boolean:
    TRUE | FALSE;

// Update FunctionCallExpression to use the common Call rule
FunctionCallExpression:
    call=Call;
