grammar IEC61131

entry Program:
    (functions+=FunctionDef | functionBlocks+=FunctionBlock | programs+=ProgramDecl)*;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\(\*[\s\S]*?\*\)/;
hidden terminal SL_COMMENT: /\/\/[^\n]*/;

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal NUMBER returns number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
terminal STRING: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/;

ProgramDecl:
    'PROGRAM' name=ID
    (varDeclarations+=VarDeclaration)*
    body=ProgramBody
    'END_PROGRAM';

FunctionDef:
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
    'BEGIN'
    statements+=Statement*
    'END';

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
    elements+=ElementAccess ('.' elements+=ElementAccess)*;

ElementAccess:
    member=ID ('[' index=Expression ']')?;

FunctionCall:
    func=[FunctionDef:ID] '(' (args+=Argument (',' args+=Argument)*)? ')' ';';

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

OrExpression:
    left=AndExpression (operators+=('OR'|'XOR') right+=AndExpression)*;

AndExpression:
    left=EqualityExpression (operators+='AND' right+=EqualityExpression)*;

EqualityExpression:
    left=RelationalExpression (operators+=('='|'<>') right+=RelationalExpression)*;

RelationalExpression:
    left=AdditiveExpression (operators+=('<'|'<='|'>'|'>=') right+=AdditiveExpression)*;

AdditiveExpression:
    left=MultiplicativeExpression (operators+=('+'|'-') right+=MultiplicativeExpression)*;

MultiplicativeExpression:
    left=PrimaryExpression (operators+=('*'|'/'|'MOD') right+=PrimaryExpression)*;

PrimaryExpression:
    '(' Expression ')' |
    Literal |
    FunctionCallExpression |
    VariableReference;

Literal:
    {infer Literal} value=(NUMBER | STRING | BOOL);

BOOL returns boolean:
    'TRUE' | 'FALSE';

VariableReference:
    elements+=ElementAccess ('.' elements+=ElementAccess)*;

FunctionCallExpression:
    func=[FunctionDef:ID] '(' (args+=Argument (',' args+=Argument)*)? ')';
