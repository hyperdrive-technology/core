grammar IEC61131
  entry Program
  hidden terminal WS = /\s+/
  hidden terminal ML_COMMENT = /\/\*[\s\S]*?\*\//
  hidden terminal SL_COMMENT = /\/\/[^\n]*/

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal NUMBER returns number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
terminal STRING: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/;

Program:
    (functions+=Function | functionBlocks+=FunctionBlock | programs+=ProgramDecl)*;

ProgramDecl:
    'PROGRAM' name=ID
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    'END_PROGRAM';

Function:
    'FUNCTION' name=ID ':' returnType=TypeDecl
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    'END_FUNCTION';

FunctionBlock:
    'FUNCTION_BLOCK' name=ID
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    'END_FUNCTION_BLOCK';

ProgramBody:
    statements+=Statement*;

VarDeclaration:
    ('VAR' | 'VAR_INPUT' | 'VAR_OUTPUT')
    variables+=VariableDecl (';' variables+=VariableDecl)*
    'END_VAR';

VariableDecl:
    name=ID ':' type=TypeDecl ('=>' initialValue=Expression)?;

TypeDecl:
    ArrayType | StructType | SimpleType;

ArrayType:
    'ARRAY' '[' start=NUMBER '..' end=NUMBER ']' 'OF' type=TypeDecl;

StructType:
    'STRUCT'
    fields+=VariableDecl (';' fields+=VariableDecl)*
    'END_STRUCT';

SimpleType:
    name=ID;

Statement:
    Assignment | IfStatement | WhileStatement | RepeatStatement | ForStatement | FunctionCall;

Assignment:
    target=LeftExpression ':=' value=Expression ';';

LeftExpression:
    (member+=ID ('[' index=Expression ']')?)+;

FunctionCall:
    func=[Function|ID] '(' (args+=Argument (',' args+=Argument)*)? ')' ';';

Argument:
    (name=ID ':=')? value=Expression;

IfStatement:
    'IF' condition=Expression 'THEN'
    thenStatements+=Statement*
    ('ELSIF' elseIfConditions+=Expression 'THEN' elseIfStatements+=Statement*)*
    ('ELSE' elseStatements+=Statement*)?
    'END_IF';

WhileStatement:
    'WHILE' condition=Expression 'DO'
    statements+=Statement*
    'END_WHILE';

RepeatStatement:
    'REPEAT'
    statements+=Statement*
    'UNTIL' condition=Expression
    'END_REPEAT';

ForStatement:
    'FOR' variable=ID ':=' start=Expression 'TO' end=Expression ('BY' step=Expression)? 'DO'
    statements+=Statement*
    'END_FOR';

Expression:
    OrExpression;

OrExpression infers Expression:
    AndExpression ({infer BinaryExpression} operator=('OR' | 'XOR') right=AndExpression)*;

AndExpression infers Expression:
    EqualityExpression ({infer BinaryExpression} operator=('AND') right=EqualityExpression)*;

EqualityExpression infers Expression:
    RelationalExpression ({infer BinaryExpression} operator=('=' | '<>') right=RelationalExpression)*;

RelationalExpression infers Expression:
    AdditiveExpression ({infer BinaryExpression} operator=('<' | '<=' | '>' | '>=') right=AdditiveExpression)*;

AdditiveExpression infers Expression:
    MultiplicativeExpression ({infer BinaryExpression} operator=('+' | '-') right=MultiplicativeExpression)*;

MultiplicativeExpression infers Expression:
    PrimaryExpression ({infer BinaryExpression} operator=('*' | '/' | 'MOD') right=PrimaryExpression)*;

PrimaryExpression infers Expression:
    '(' Expression ')' |
    Literal |
    FunctionCallExpression |
    VariableReference;

Literal:
    {infer Literal} value=(NUMBER | STRING | BOOL);

BOOL returns boolean:
    'TRUE' | 'FALSE';

VariableReference:
    {infer VariableReference} (members+=ID ('[' index=Expression ']')?)+;

FunctionCallExpression:
    func=[Function|ID] '(' (args+=Argument (',' args+=Argument)*)? ')';
