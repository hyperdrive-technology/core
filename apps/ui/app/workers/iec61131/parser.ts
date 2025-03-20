import { createToken, CstParser, Lexer, TokenType } from 'chevrotain';
import type { Program } from './ast';
import { IEC61131Visitor } from './visitor';

export interface IECCompilerResult {
  diagnostics: Array<{
    severity: 'error' | 'warning';
    message: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
  ast?: Program;
  success: boolean;
}

// Create tokens array for lexer
const allTokens: TokenType[] = [];

// First define whitespace and comments
const WS = createToken({
  name: 'WS',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

const ML_COMMENT = createToken({
  name: 'ML_COMMENT',
  pattern: /\(\*[\s\S]*?\*\)/,
  group: Lexer.SKIPPED,
});

const SL_COMMENT = createToken({
  name: 'SL_COMMENT',
  pattern: /\/\/[^\n]*/,
  group: Lexer.SKIPPED,
});

allTokens.push(WS, ML_COMMENT, SL_COMMENT);

// Define keywords (using strings instead of regexes)
// Important: In Chevrotain, the order of token definitions matters
// Keywords must come before identifiers to ensure proper token recognition
const keywordTokens: Record<string, TokenType> = {};

// Create token map for parser to use
const tokenMap = new Map<string, TokenType>();

// Define keywords with proper token creation
[
  'FUNCTION_BLOCK',
  'END_FUNCTION_BLOCK',
  'VAR_INPUT',
  'VAR_OUTPUT',
  'VAR_IN_OUT',
  'VAR_EXTERNAL',
  'VAR_GLOBAL',
  'VAR_TEMP',
  'END_PROGRAM',
  'END_FUNCTION',
  'END_WHILE',
  'END_REPEAT',
  'END_STRUCT',
  'END_IF',
  'END_FOR',
  'END_VAR',
  'END_CASE',
  'END_TYPE',
  'TYPE',
  'FUNCTION',
  'PROGRAM',
  'REPEAT',
  'STRUCT',
  'WHILE',
  'ARRAY',
  'BEGIN',
  'ELSIF',
  'UNTIL',
  'ELSE',
  'THEN',
  'CONSTANT',
  'RETAIN',
  'VAR',
  'FOR',
  'END',
  'IF',
  'OF',
  'TO',
  'BY',
  'DO',
  'CASE',
  'RETURN',
  'TRUE',
  'FALSE',
  'AND',
  'OR',
  'XOR',
  'NOT',
  'MOD',
].forEach((keyword) => {
  // Use word boundaries to ensure we match whole keywords
  // This is crucial for avoiding conflicts with identifiers
  const token = createToken({
    name: keyword,
    pattern: new RegExp(`\\b${keyword}\\b`, 'i'),
    longer_alt: undefined, // Will be set later for identifiers
  });

  keywordTokens[keyword] = token;
  tokenMap.set(keyword, token);
  allTokens.push(token);
});

// Add operators and punctuation
const operators = {
  ASSIGN: ':=',
  PLUS: '+',
  MINUS: '-',
  MULTIPLY: '*',
  DIVIDE: '/',
  LESS_EQUAL: '<=',
  GREATER_EQUAL: '>=',
  NOT_EQUAL: '<>',
  EQUAL: '=',
  LESS: '<',
  GREATER: '>',
  DOT: '.',
  COMMA: ',',
  SEMICOLON: ';',
  COLON: ':',
  LPAREN: '(',
  RPAREN: ')',
  LBRACKET: '[',
  RBRACKET: ']',
};

Object.entries(operators).forEach(([name, pattern]) => {
  const token = createToken({ name, pattern });
  tokenMap.set(name, token);
  allTokens.push(token);
});

// Add direct addressing token before IDENTIFIER
const DIRECT_ADDRESS = createToken({
  name: 'DIRECT_ADDRESS',
  pattern: /#[a-zA-Z0-9_.%IX][a-zA-Z0-9_.%IX]*/,
  line_breaks: false,
});
allTokens.push(DIRECT_ADDRESS);

// Add identifiers and literals last
const IDENTIFIER = createToken({
  name: 'IDENTIFIER',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

// Setup the longer_alt for keywords that might be mistaken as identifiers
Object.values(keywordTokens).forEach((keywordToken) => {
  // This ensures keywords take precedence over identifiers when there's ambiguity
  keywordToken.LONGER_ALT = IDENTIFIER;
});

const NUMBER = createToken({
  name: 'NUMBER',
  pattern: /[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/,
});

const STRING = createToken({
  name: 'STRING',
  pattern: /'[^']*'|"[^"]*"/,
});

allTokens.push(IDENTIFIER, NUMBER, STRING);

// Create lexer instance with proper configuration
const lexer = new Lexer(allTokens, {
  recoveryEnabled: true,
  positionTracking: 'full',
  ensureOptimizations: true,
  skipValidations: false,
});

// Create parser class
export class IEC61131Parser extends CstParser {
  public lexer: Lexer;

  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      maxLookahead: 3,
      nodeLocationTracking: 'full',
    });
    this.lexer = lexer;
    this.performSelfAnalysis();
  }

  // Define parsing rules
  public program = this.RULE('program', () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.functionDef) },
        { ALT: () => this.SUBRULE(this.functionBlock) },
        { ALT: () => this.SUBRULE(this.programDecl) },
        { ALT: () => this.SUBRULE(this.enumType) },
      ]);

      // Optional semicolon between declarations
      this.OPTION(() => {
        this.CONSUME(tokenMap.get('SEMICOLON')!);
      });
    });
  });

  private functionDef = this.RULE('functionDef', () => {
    this.CONSUME(tokenMap.get('FUNCTION')!);
    this.CONSUME(IDENTIFIER);
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('COLON')!);
      this.SUBRULE(this.dataType);
    });
    this.MANY(() => this.SUBRULE(this.varDeclaration));
    this.CONSUME(tokenMap.get('BEGIN')!);
    this.MANY2(() => this.SUBRULE(this.statement));
    this.CONSUME(tokenMap.get('END_FUNCTION')!);
  });

  private functionBlock = this.RULE('functionBlock', () => {
    this.CONSUME(tokenMap.get('FUNCTION_BLOCK')!);
    this.CONSUME(IDENTIFIER);
    this.MANY(() => this.SUBRULE(this.varDeclaration));
    this.CONSUME(tokenMap.get('BEGIN')!);
    this.MANY2(() => this.SUBRULE(this.statement));
    this.OR([
      { ALT: () => this.CONSUME(tokenMap.get('END_FUNCTION_BLOCK')!) },
      { ALT: () => this.CONSUME(tokenMap.get('END')!) },
    ]);
  });

  private programDecl = this.RULE('programDecl', () => {
    this.CONSUME(tokenMap.get('PROGRAM')!);
    this.CONSUME(IDENTIFIER);
    this.MANY(() => this.SUBRULE(this.varDeclaration));
    this.CONSUME(tokenMap.get('BEGIN')!);
    this.MANY2(() => this.SUBRULE(this.statement));
    this.OR([
      { ALT: () => this.CONSUME(tokenMap.get('END_PROGRAM')!) },
      { ALT: () => this.CONSUME(tokenMap.get('END')!) },
    ]);
  });

  private varDeclaration = this.RULE('varDeclaration', () => {
    this.OR([
      { ALT: () => this.CONSUME(tokenMap.get('VAR_INPUT')!) },
      { ALT: () => this.CONSUME(tokenMap.get('VAR_OUTPUT')!) },
      { ALT: () => this.CONSUME(tokenMap.get('VAR_IN_OUT')!) },
      { ALT: () => this.CONSUME(tokenMap.get('VAR')!) },
    ]);
    this.MANY(() => {
      this.SUBRULE(this.varDeclLine);
    });
    this.CONSUME(tokenMap.get('END_VAR')!);
  });

  private varDeclLine = this.RULE('varDeclLine', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(IDENTIFIER);
          this.CONSUME(tokenMap.get('COLON')!);
          this.SUBRULE(this.dataType);
          this.OPTION(() => {
            this.CONSUME(tokenMap.get('ASSIGN')!);
            this.SUBRULE(this.expression);
          });
        },
      },
      {
        ALT: () => {
          this.CONSUME2(IDENTIFIER);
          this.CONSUME2(tokenMap.get('ASSIGN')!);
          this.SUBRULE2(this.expression);
        },
      },
    ]);
    this.OPTION2(() => {
      this.CONSUME(tokenMap.get('SEMICOLON')!);
    });
  });

  private dataType = this.RULE('dataType', () => {
    this.OR([
      { ALT: () => this.CONSUME(IDENTIFIER) },
      { ALT: () => this.SUBRULE(this.arrayType) },
    ]);
  });

  private arrayType = this.RULE('arrayType', () => {
    this.CONSUME(tokenMap.get('ARRAY')!);
    this.CONSUME(tokenMap.get('LBRACKET')!);
    this.SUBRULE1(this.expression);
    this.CONSUME(tokenMap.get('DOT')!);
    this.CONSUME2(tokenMap.get('DOT')!);
    this.SUBRULE2(this.expression);
    this.CONSUME(tokenMap.get('RBRACKET')!);
    this.CONSUME(tokenMap.get('OF')!);
    this.SUBRULE(this.dataType);
  });

  private statement = this.RULE('statement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.assignmentStmt) },
      { ALT: () => this.SUBRULE(this.ifStmt) },
      { ALT: () => this.SUBRULE(this.whileStmt) },
      { ALT: () => this.SUBRULE(this.repeatStmt) },
      { ALT: () => this.SUBRULE(this.forStmt) },
      { ALT: () => this.SUBRULE(this.caseStmt) },
      { ALT: () => this.SUBRULE(this.functionCall) },
      { ALT: () => this.SUBRULE(this.returnStmt) },
    ]);
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('SEMICOLON')!);
    });
  });

  private assignmentStmt = this.RULE('assignmentStmt', () => {
    this.OR([
      { ALT: () => this.CONSUME(IDENTIFIER) },
      { ALT: () => this.CONSUME(DIRECT_ADDRESS) },
    ]);
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('DOT')!);
      this.CONSUME2(IDENTIFIER);
    });
    this.CONSUME(tokenMap.get('ASSIGN')!);
    this.SUBRULE(this.expression);
  });

  private expression = this.RULE('expression', () => {
    this.SUBRULE(this.orExpression);
  });

  private orExpression = this.RULE('orExpression', () => {
    this.SUBRULE(this.andExpression);
    this.MANY(() => {
      this.CONSUME(tokenMap.get('OR')!);
      this.SUBRULE2(this.andExpression);
    });
  });

  private andExpression = this.RULE('andExpression', () => {
    this.SUBRULE(this.relationalExpression);
    this.MANY(() => {
      this.CONSUME(tokenMap.get('AND')!);
      this.SUBRULE2(this.relationalExpression);
    });
  });

  private relationalExpression = this.RULE('relationalExpression', () => {
    this.SUBRULE(this.additiveExpression);
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokenMap.get('EQUAL')!) },
        { ALT: () => this.CONSUME(tokenMap.get('NOT_EQUAL')!) },
        { ALT: () => this.CONSUME(tokenMap.get('LESS')!) },
        { ALT: () => this.CONSUME(tokenMap.get('LESS_EQUAL')!) },
        { ALT: () => this.CONSUME(tokenMap.get('GREATER')!) },
        { ALT: () => this.CONSUME(tokenMap.get('GREATER_EQUAL')!) },
      ]);
      this.SUBRULE2(this.additiveExpression);
    });
  });

  private additiveExpression = this.RULE('additiveExpression', () => {
    this.SUBRULE(this.multiplicativeExpression);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokenMap.get('PLUS')!) },
        { ALT: () => this.CONSUME(tokenMap.get('MINUS')!) },
      ]);
      this.SUBRULE2(this.multiplicativeExpression);
    });
  });

  private multiplicativeExpression = this.RULE(
    'multiplicativeExpression',
    () => {
      this.SUBRULE(this.unaryExpression);
      this.MANY(() => {
        this.OR([
          { ALT: () => this.CONSUME(tokenMap.get('MULTIPLY')!) },
          { ALT: () => this.CONSUME(tokenMap.get('DIVIDE')!) },
          { ALT: () => this.CONSUME(tokenMap.get('MOD')!) },
        ]);
        this.SUBRULE2(this.unaryExpression);
      });
    }
  );

  private unaryExpression = this.RULE('unaryExpression', () => {
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokenMap.get('NOT')!) },
        { ALT: () => this.CONSUME(tokenMap.get('MINUS')!) },
      ]);
    });
    this.SUBRULE(this.primaryExpression);
  });

  private primaryExpression = this.RULE('primaryExpression', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.functionCall) },
      { ALT: () => this.SUBRULE(this.variableAccess) },
      { ALT: () => this.CONSUME(DIRECT_ADDRESS) },
      { ALT: () => this.CONSUME(NUMBER) },
      { ALT: () => this.CONSUME(STRING) },
      { ALT: () => this.CONSUME(tokenMap.get('TRUE')!) },
      { ALT: () => this.CONSUME(tokenMap.get('FALSE')!) },
      {
        ALT: () => {
          this.CONSUME(tokenMap.get('LPAREN')!);
          this.SUBRULE(this.expression);
          this.CONSUME(tokenMap.get('RPAREN')!);
        },
      },
    ]);
  });

  private functionCall = this.RULE('functionCall', () => {
    this.CONSUME(IDENTIFIER);
    this.CONSUME(tokenMap.get('LPAREN')!);

    // Handle optional argument list
    this.OPTION(() => {
      // First argument
      this.SUBRULE(this.functionArgument);

      // Additional arguments
      this.MANY(() => {
        this.CONSUME(tokenMap.get('COMMA')!);
        this.SUBRULE2(this.functionArgument);
      });
    });

    this.CONSUME(tokenMap.get('RPAREN')!);
  });

  private functionArgument = this.RULE('functionArgument', () => {
    // Check if it's a named parameter
    this.OPTION(() => {
      this.CONSUME(IDENTIFIER);
      this.CONSUME(tokenMap.get('ASSIGN')!);
    });

    // The value part - can be expression or direct address
    this.OR([
      { ALT: () => this.CONSUME(DIRECT_ADDRESS) },
      { ALT: () => this.SUBRULE(this.expression) },
    ]);
  });

  private ifStmt = this.RULE('ifStmt', () => {
    this.CONSUME(tokenMap.get('IF')!);
    this.SUBRULE(this.expression);
    this.CONSUME(tokenMap.get('THEN')!);
    this.MANY(() => this.SUBRULE(this.statement));
    this.MANY2(() => {
      this.CONSUME(tokenMap.get('ELSIF')!);
      this.SUBRULE2(this.expression);
      this.CONSUME2(tokenMap.get('THEN')!);
      this.MANY3(() => this.SUBRULE2(this.statement));
    });
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('ELSE')!);
      this.MANY4(() => this.SUBRULE3(this.statement));
    });
    this.CONSUME(tokenMap.get('END_IF')!);
  });

  private whileStmt = this.RULE('whileStmt', () => {
    this.CONSUME(tokenMap.get('WHILE')!);
    this.SUBRULE(this.expression);
    this.CONSUME(tokenMap.get('DO')!);
    this.MANY(() => this.SUBRULE(this.statement));
    this.CONSUME(tokenMap.get('END_WHILE')!);
  });

  private repeatStmt = this.RULE('repeatStmt', () => {
    this.CONSUME(tokenMap.get('REPEAT')!);
    this.MANY(() => this.SUBRULE(this.statement));
    this.CONSUME(tokenMap.get('UNTIL')!);
    this.SUBRULE(this.expression);
    this.CONSUME(tokenMap.get('END_REPEAT')!);
  });

  private forStmt = this.RULE('forStmt', () => {
    this.CONSUME(tokenMap.get('FOR')!);
    this.CONSUME(IDENTIFIER);
    this.CONSUME(tokenMap.get('ASSIGN')!);
    this.SUBRULE1(this.expression);
    this.CONSUME(tokenMap.get('TO')!);
    this.SUBRULE2(this.expression);
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('BY')!);
      this.SUBRULE3(this.expression);
    });
    this.CONSUME(tokenMap.get('DO')!);
    this.MANY(() => this.SUBRULE4(this.statement));
    this.CONSUME(tokenMap.get('END_FOR')!);
  });

  private caseStmt = this.RULE('caseStmt', () => {
    this.CONSUME(tokenMap.get('CASE')!);
    this.SUBRULE(this.expression);
    this.CONSUME(tokenMap.get('OF')!);
    this.MANY(() => {
      this.SUBRULE2(this.expression);
      this.CONSUME(tokenMap.get('COLON')!);
      this.SUBRULE(this.statement);
    });
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('ELSE')!);
      this.MANY2(() => this.SUBRULE3(this.statement));
    });
    this.CONSUME(tokenMap.get('END_CASE')!);
  });

  private returnStmt = this.RULE('returnStmt', () => {
    this.CONSUME(tokenMap.get('RETURN')!);
    this.OPTION(() => {
      this.SUBRULE(this.expression);
    });
  });

  private variableAccess = this.RULE('variableAccess', () => {
    this.CONSUME(IDENTIFIER);
    this.MANY(() => {
      this.CONSUME(tokenMap.get('DOT')!);
      this.CONSUME2(IDENTIFIER);
    });
  });

  private enumType = this.RULE('enumType', () => {
    this.CONSUME(tokenMap.get('TYPE')!);
    this.CONSUME(IDENTIFIER);
    this.CONSUME(tokenMap.get('COLON')!);
    this.CONSUME(tokenMap.get('LPAREN')!);
    this.MANY(() => {
      this.CONSUME2(IDENTIFIER);
      this.OPTION(() => {
        this.CONSUME(tokenMap.get('COMMA')!);
      });
    });
    this.CONSUME(tokenMap.get('RPAREN')!);
    this.CONSUME(tokenMap.get('END_TYPE')!);
  });
}

// Create parser instance and visitor instance
const parser = new IEC61131Parser();
const visitor = new IEC61131Visitor();

/**
 * Parse and validate an IEC 61131-3 document using Chevrotain directly
 */
export function validateIEC61131Document(
  iec61131Code: string
): IECCompilerResult {
  try {
    // Tokenize the input
    const lexResult = parser.lexer.tokenize(iec61131Code);

    // Check for lexing errors
    const lexerDiagnostics = lexResult.errors.map((error) => ({
      severity: 'error' as const,
      message: error.message,
      range: {
        start: {
          line: error.line ?? 0,
          character: error.column ?? 0,
        },
        end: {
          line: error.line ?? 0,
          character: (error.column ?? 0) + (error.length ?? 1),
        },
      },
    }));

    if (lexerDiagnostics.length > 0) {
      return {
        success: false,
        ast: undefined,
        diagnostics: lexerDiagnostics,
      };
    }

    // Parse the tokens
    parser.input = lexResult.tokens;
    const cst = parser.program();

    // Check for parsing errors
    const parserDiagnostics = parser.errors.map((error) => ({
      severity: 'error' as const,
      message: error.message,
      range: {
        start: {
          line: error.token.startLine ?? 0,
          character: error.token.startColumn ?? 0,
        },
        end: {
          line: error.token.endLine ?? 0,
          character: error.token.endColumn ?? 0,
        },
      },
    }));

    if (parserDiagnostics.length > 0) {
      return {
        success: false,
        ast: undefined,
        diagnostics: parserDiagnostics,
      };
    }

    // Convert CST to AST using visitor
    try {
      const ast = visitor.visit(cst);
      return {
        success: true,
        ast,
        diagnostics: [],
      };
    } catch (error) {
      console.error('Error during CST to AST conversion:', error);
      return {
        success: false,
        ast: undefined,
        diagnostics: [
          {
            severity: 'error' as const,
            message: `Semantic error: ${
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
  } catch (error) {
    console.error('Error during IEC-61131 compilation:', error);

    return {
      success: false,
      ast: undefined,
      diagnostics: [
        {
          severity: 'error' as const,
          message: `Parser error: ${
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
