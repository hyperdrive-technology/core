import { createToken, CstParser, Lexer, TokenType } from 'chevrotain';
import { LLStarLookaheadStrategy } from 'chevrotain-allstar';
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

// Add EOF token - must be first in the token list
const EOF = createToken({
  name: 'EOF',
  pattern: Lexer.NA,
});

allTokens.push(EOF, WS, ML_COMMENT, SL_COMMENT);

// Create token map for parser to use
const tokenMap = new Map<string, TokenType>();

// Add EOF to token map
tokenMap.set('EOF', EOF);

// Define keywords (using strings instead of regexes)
// Important: In Chevrotain, the order of token definitions matters
// Keywords must come before identifiers to ensure proper token recognition
const keywordTokens: Record<string, TokenType> = {};

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
  'TON',
  'TOF',
  'TP',
].forEach((keyword) => {
  // Create patterns based on the keyword
  let pattern;

  // Special handling for END tokens to ensure they're properly distinguished
  if (
    keyword === 'END_FUNCTION_BLOCK' ||
    keyword === 'END_PROGRAM' ||
    keyword === 'END_FUNCTION' ||
    keyword === 'END_WHILE' ||
    keyword === 'END_REPEAT' ||
    keyword === 'END_STRUCT' ||
    keyword === 'END_IF' ||
    keyword === 'END_FOR' ||
    keyword === 'END_VAR' ||
    keyword === 'END_CASE' ||
    keyword === 'END_TYPE'
  ) {
    // For END_X tokens, match exactly as specified with word boundary
    pattern = new RegExp(`\\b${keyword}\\b`, 'i');
  } else if (keyword === 'END') {
    // For END token, ensure it's not part of a longer token
    pattern = /\bEND\b(?!_)/i;
  } else {
    // For regular keywords, use word boundaries
    pattern = new RegExp(`\\b${keyword}\\b`, 'i');
  }

  const token = createToken({
    name: keyword,
    pattern: pattern,
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

// Add time literal token with more precise pattern
const TIME_LITERAL = createToken({
  name: 'TIME_LITERAL',
  pattern: /T#[0-9smhd_]+(ms)?|TIME#[0-9smhd_]+(ms)?/i,
  line_breaks: false,
});

// Add direct addressing token
const DIRECT_ADDRESS = createToken({
  name: 'DIRECT_ADDRESS',
  pattern: /#[a-zA-Z0-9_.%:]+/,
  line_breaks: false,
});

// Add enum reference token
const ENUM_REFERENCE = createToken({
  name: 'ENUM_REFERENCE',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*#[a-zA-Z_][a-zA-Z0-9_]*/,
  line_breaks: false,
});

// Add identifiers and literals
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

// Add tokens in the specific order to ensure correct token recognition priority
allTokens.push(
  TIME_LITERAL,
  DIRECT_ADDRESS,
  ENUM_REFERENCE,
  NUMBER,
  STRING,
  IDENTIFIER
);

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
      lookaheadStrategy: new LLStarLookaheadStrategy(),
      nodeLocationTracking: 'full',
    });
    this.lexer = lexer;
    this.performSelfAnalysis();
  }

  // Define parsing rules
  public program = this.RULE('program', () => {
    // Handle all top-level declarations
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.functionDef) },
        { ALT: () => this.SUBRULE(this.functionBlock) },
        { ALT: () => this.SUBRULE(this.programDecl) },
        { ALT: () => this.SUBRULE(this.enumType) },
        { ALT: () => this.SUBRULE(this.structType) },
      ]);

      // Optional semicolon between declarations
      this.OPTION(() => {
        this.CONSUME(tokenMap.get('SEMICOLON')!);
      });
    });

    // Optional EOF at the end - the input might end naturally without an explicit EOF token
    this.OPTION2(() => {
      this.CONSUME(EOF);
    });
  });

  private functionDef = this.RULE('functionDef', () => {
    this.CONSUME(keywordTokens['FUNCTION']);
    this.CONSUME(IDENTIFIER);
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('COLON')!);
      this.SUBRULE(this.dataType);
    });

    // Allow var declarations
    this.MANY(() => this.SUBRULE(this.varDeclaration));

    // Allow type definitions as inner types
    this.MANY2(() => this.SUBRULE(this.innerTypeDeclaration));

    // Allow more var declarations after inner types
    this.MANY3(() => this.SUBRULE2(this.varDeclaration));

    // Function body statements
    this.MANY4(() => this.SUBRULE(this.statement));

    this.CONSUME(keywordTokens['END_FUNCTION']);
  });

  // A simpler inner type declaration rule specifically for use inside functions
  private innerTypeDeclaration = this.RULE('innerTypeDeclaration', () => {
    this.CONSUME(tokenMap.get('TYPE')!);
    this.CONSUME(IDENTIFIER);
    this.CONSUME(tokenMap.get('COLON')!);
    this.SUBRULE(this.dataType);

    // We need to make the assignment part optional to match CalType : REAL := 5.0
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('ASSIGN')!);
      this.SUBRULE(this.expression);
    });

    // Optional semicolon
    this.OPTION2(() => {
      this.CONSUME(tokenMap.get('SEMICOLON')!);
    });

    this.CONSUME(tokenMap.get('END_TYPE')!);
  });

  private functionBlock = this.RULE('functionBlock', () => {
    this.CONSUME(keywordTokens['FUNCTION_BLOCK']);
    this.CONSUME(IDENTIFIER);
    this.MANY(() => this.SUBRULE(this.varDeclaration));

    // Allow statements and type definitions directly in function block or inside BEGIN/END block
    this.OR([
      {
        ALT: () => {
          // Direct statements and type definitions without BEGIN/END
          this.MANY2(() => {
            this.OR2([
              { ALT: () => this.SUBRULE2(this.statement) },
              { ALT: () => this.SUBRULE(this.enumType) },
              { ALT: () => this.SUBRULE(this.structType) },
            ]);
          });
        },
      },
      {
        ALT: () => {
          // BEGIN/END block with statements and type definitions
          this.CONSUME(keywordTokens['BEGIN']);
          this.MANY3(() => {
            this.OR3([
              { ALT: () => this.SUBRULE3(this.statement) },
              { ALT: () => this.SUBRULE2(this.enumType) },
              { ALT: () => this.SUBRULE2(this.structType) },
            ]);
          });
          this.CONSUME(keywordTokens['END']);
        },
      },
    ]);

    this.CONSUME(keywordTokens['END_FUNCTION_BLOCK']);
  });

  private programDecl = this.RULE('programDecl', () => {
    this.CONSUME(keywordTokens['PROGRAM']);
    this.CONSUME(IDENTIFIER);
    this.MANY(() => this.SUBRULE(this.varDeclaration));
    this.CONSUME(keywordTokens['BEGIN']);
    this.MANY2(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.statement) },
        { ALT: () => this.SUBRULE(this.enumType) },
        { ALT: () => this.SUBRULE(this.structType) },
      ]);
    });
    this.CONSUME(keywordTokens['END']);
    this.CONSUME(keywordTokens['END_PROGRAM']);
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

          // Handle range constraints like SINT (-5..5)
          this.OPTION(() => {
            this.CONSUME(tokenMap.get('LPAREN')!);
            this.SUBRULE(this.expression, { LABEL: 'rangeStart' });
            this.CONSUME(tokenMap.get('DOT')!);
            this.CONSUME2(tokenMap.get('DOT')!);
            this.SUBRULE2(this.expression, { LABEL: 'rangeEnd' });
            this.CONSUME(tokenMap.get('RPAREN')!);
          });

          this.OPTION2(() => {
            this.CONSUME(tokenMap.get('ASSIGN')!);
            this.SUBRULE3(this.arrayInitializer);
          });
        },
      },
      {
        ALT: () => {
          this.CONSUME2(IDENTIFIER);
          this.CONSUME2(tokenMap.get('ASSIGN')!);
          this.SUBRULE4(this.expression);
        },
      },
    ]);
    this.OPTION3(() => {
      this.CONSUME(tokenMap.get('SEMICOLON')!);
    });
  });

  private arrayInitializer = this.RULE('arrayInitializer', () => {
    this.OR([
      {
        ALT: () => {
          // Handle array initializer with square brackets
          this.CONSUME(tokenMap.get('LBRACKET')!);
          this.SUBRULE(this.expression);
          this.MANY(() => {
            this.CONSUME(tokenMap.get('COMMA')!);
            this.SUBRULE2(this.expression);
          });
          this.CONSUME(tokenMap.get('RBRACKET')!);
        },
      },
      {
        ALT: () => {
          // Handle standard expression (for non-array initializers)
          this.SUBRULE3(this.expression);
        },
      },
    ]);
  });

  private dataType = this.RULE('dataType', () => {
    this.OR([
      { ALT: () => this.CONSUME(IDENTIFIER) },
      { ALT: () => this.CONSUME(keywordTokens['TON']) },
      { ALT: () => this.CONSUME(keywordTokens['TOF']) },
      { ALT: () => this.CONSUME(keywordTokens['TP']) },
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
      { ALT: () => this.SUBRULE(this.typeDeclaration) },
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
      { ALT: () => this.SUBRULE(this.arrayAccess) },
      { ALT: () => this.SUBRULE(this.variableAccess) },
      { ALT: () => this.CONSUME(DIRECT_ADDRESS) },
      { ALT: () => this.CONSUME(ENUM_REFERENCE) },
      { ALT: () => this.CONSUME(TIME_LITERAL) },
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

  // Add a new rule for array access
  private arrayAccess = this.RULE('arrayAccess', () => {
    this.CONSUME(IDENTIFIER);
    this.CONSUME(tokenMap.get('LBRACKET')!);
    this.SUBRULE(this.expression);
    this.CONSUME(tokenMap.get('RBRACKET')!);
  });

  private functionCall = this.RULE('functionCall', () => {
    // Handle both identifiers and member access (object.property)
    this.OR([
      // Simple function call with an identifier
      { ALT: () => this.CONSUME(IDENTIFIER, { LABEL: 'functionName' }) },

      // Object method call through member access (e.g., timer.Q)
      {
        ALT: () => {
          this.CONSUME2(IDENTIFIER, { LABEL: 'objectName' });
          this.CONSUME(tokenMap.get('DOT')!);
          this.CONSUME3(IDENTIFIER, { LABEL: 'memberName' });
        },
      },
    ]);

    // Now handle arguments - this is optional because some calls like timer.Q don't have arguments
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('LPAREN')!);

      // Optional arguments
      this.OPTION2(() => {
        // First argument
        this.SUBRULE(this.functionArgument);

        // More arguments separated by commas
        this.MANY(() => {
          this.CONSUME(tokenMap.get('COMMA')!);
          this.SUBRULE2(this.functionArgument);
        });
      });

      this.CONSUME(tokenMap.get('RPAREN')!);
    });
  });

  private functionArgument = this.RULE('functionArgument', () => {
    // Reorganize with a clearer grammar structure to avoid ambiguity
    this.OR([
      {
        // Named argument (positional with name=value syntax)
        ALT: () => {
          this.SUBRULE(this.namedArgument);
        },
      },
      {
        // Positional argument (just a value)
        ALT: () => {
          this.SUBRULE(this.positionalArgument);
        },
      },
    ]);
  });

  // Named argument has an explicit parameter name
  private namedArgument = this.RULE('namedArgument', () => {
    this.CONSUME(IDENTIFIER, { LABEL: 'paramName' });
    this.CONSUME(tokenMap.get('ASSIGN')!);
    this.SUBRULE(this.argumentValue, { LABEL: 'value' });
  });

  // Positional argument is just a value
  private positionalArgument = this.RULE('positionalArgument', () => {
    this.SUBRULE(this.argumentValue, { LABEL: 'value' });
  });

  // The value part of an argument can be one of these types
  private argumentValue = this.RULE('argumentValue', () => {
    // Instead of using GATE which isn't working correctly with ALL(*),
    // we'll use a more specific approach with explicit token checks
    if (this.LA(1).tokenType === TIME_LITERAL) {
      this.CONSUME(TIME_LITERAL, { LABEL: 'timeLiteral' });
    } else if (this.LA(1).tokenType === DIRECT_ADDRESS) {
      this.CONSUME(DIRECT_ADDRESS, { LABEL: 'directAddress' });
    } else {
      this.SUBRULE(this.expression, { LABEL: 'expression' });
    }
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
      this.OR([
        // Handle numeric literals directly
        {
          ALT: () => {
            this.CONSUME(NUMBER);
            this.CONSUME(tokenMap.get('COLON')!);
            this.MANY2(() => this.SUBRULE(this.statement));
          },
        },
        // Handle general expressions
        {
          ALT: () => {
            this.SUBRULE2(this.expression);
            this.CONSUME2(tokenMap.get('COLON')!);
            this.MANY3(() => this.SUBRULE2(this.statement));
          },
        },
      ]);
    });
    this.OPTION(() => {
      this.CONSUME(tokenMap.get('ELSE')!);
      this.MANY4(() => this.SUBRULE3(this.statement));
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

    // Handle array indexing or dot notation (or both)
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            // Array indexing with [expression]
            this.CONSUME(tokenMap.get('LBRACKET')!);
            this.SUBRULE(this.expression);
            this.CONSUME(tokenMap.get('RBRACKET')!);
          },
        },
        {
          ALT: () => {
            // Dot notation for struct or object access
            this.CONSUME(tokenMap.get('DOT')!);
            this.CONSUME2(IDENTIFIER);
          },
        },
      ]);
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
    this.CONSUME(tokenMap.get('SEMICOLON')!);
    this.CONSUME(tokenMap.get('END_TYPE')!);
  });

  private structType = this.RULE('structType', () => {
    this.CONSUME(tokenMap.get('TYPE')!);
    this.CONSUME(IDENTIFIER);
    this.CONSUME(tokenMap.get('COLON')!);
    this.CONSUME(tokenMap.get('STRUCT')!);

    // Process struct member declarations
    this.MANY(() => {
      this.CONSUME2(IDENTIFIER);
      this.CONSUME2(tokenMap.get('COLON')!);
      this.SUBRULE(this.dataType);
      this.OPTION(() => {
        this.CONSUME2(tokenMap.get('ASSIGN')!);
        this.SUBRULE2(this.expression);
      });
      this.CONSUME3(tokenMap.get('SEMICOLON')!);
    });

    this.CONSUME(tokenMap.get('END_STRUCT')!);
    this.CONSUME4(tokenMap.get('SEMICOLON')!);
    this.CONSUME(tokenMap.get('END_TYPE')!);
  });

  private typeDeclaration = this.RULE('typeDeclaration', () => {
    this.CONSUME(tokenMap.get('TYPE')!);
    this.CONSUME(IDENTIFIER);

    // Handle both formats:
    // 1. TYPE CalType : REAL := 5.0;
    // 2. TYPE CalType := 5.0;
    this.OR([
      {
        ALT: () => {
          // Type declaration with a data type and optional initialization
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
          // Direct initialization without data type
          this.CONSUME2(tokenMap.get('ASSIGN')!);
          this.SUBRULE2(this.expression);
        },
      },
    ]);

    this.OPTION2(() => {
      this.CONSUME(tokenMap.get('SEMICOLON')!);
    });

    this.CONSUME(tokenMap.get('END_TYPE')!);
  });
}

// Create parser instance and visitor instance
const parser = new IEC61131Parser();

/**
 * Parse and validate an IEC 61131-3 document using Chevrotain directly
 */
export function validateIEC61131Document(
  iec61131Code: string
): IECCompilerResult {
  try {
    console.log('Starting lexical analysis...');

    // Tokenize the input
    const lexResult = parser.lexer.tokenize(iec61131Code);

    // Log token counts by type
    const tokenCounts: Record<string, number> = {};
    lexResult.tokens.forEach((token) => {
      const tokenType = token.tokenType.name;
      tokenCounts[tokenType] = (tokenCounts[tokenType] || 0) + 1;
    });

    console.log('Token type counts:', tokenCounts);

    // Debug: Log time literals and direct addresses specifically
    console.log('TIME_LITERAL tokens:');
    lexResult.tokens
      .filter((token) => token.tokenType.name === 'TIME_LITERAL')
      .forEach((token) => {
        console.log(
          `  ${token.image} at line ${token.startLine}:${token.startColumn}`
        );
      });

    console.log('DIRECT_ADDRESS tokens:');
    lexResult.tokens
      .filter((token) => token.tokenType.name === 'DIRECT_ADDRESS')
      .forEach((token) => {
        console.log(
          `  ${token.image} at line ${token.startLine}:${token.startColumn}`
        );
      });

    // Debug: Log the tokens to see what's being recognized
    console.log('Tokens recognized (first 50 and last 50):');
    lexResult.tokens.forEach((token, index) => {
      if (index < 50 || index > lexResult.tokens.length - 50) {
        console.log(
          `Token ${index}: ${token.tokenType.name} - '${token.image}' at line ${token.startLine}:${token.startColumn}`
        );
      }
    });

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
      console.log('Lexer diagnostics:', lexerDiagnostics);
      return {
        success: false,
        ast: undefined,
        diagnostics: lexerDiagnostics,
      };
    }

    console.log('Starting parsing...');

    try {
      // Parse the tokens
      parser.input = lexResult.tokens;
      const cst = parser.program();

      console.log('Parsing complete. Checking for errors...');

      // Check for parsing errors
      const parserDiagnostics = parser.errors.map((error) => {
        console.log('Parser error:', error);

        let message = error.message;

        // For token mismatch errors, provide more context
        if (error.name === 'MismatchedTokenException') {
          // Add expected vs. found information
          const expectedToken =
            (error as any).expectedTokenType?.name || 'unknown';
          const actualToken = error.token?.image || 'unknown';
          message = `Expected '${expectedToken}' but found '${actualToken}'. ${message}`;
        }

        return {
          severity: 'error' as const,
          message: message,
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
        };
      });

      if (parserDiagnostics.length > 0) {
        console.log('Parser diagnostics:', parserDiagnostics);
        return {
          success: false,
          ast: undefined,
          diagnostics: parserDiagnostics,
        };
      }

      console.log('Parsing successful. Starting CST to AST conversion...');

      // Create a visitor instance for CST to AST conversion
      const visitor = new IEC61131Visitor();

      // Convert CST to AST
      const ast = visitor.visit(cst);

      console.log('CST to AST conversion complete.');

      // Semantic analysis would go here
      // TODO: Implement semantic analysis

      return {
        success: true,
        ast,
        diagnostics: [],
      };
    } catch (error) {
      // Check if it's an ALL(*) lookahead error
      if (
        error instanceof Error &&
        error.message.includes('Ambiguous Alternatives Detected')
      ) {
        console.error('ALL(*) lookahead error:', error);

        // Get more specific details to help with debugging
        let errorDetails = error.message;
        let lineInfo = '';

        // Specifically look for TIME_LITERAL or DIRECT_ADDRESS issues
        if (error.message.includes('TIME_LITERAL')) {
          // Find TIME_LITERAL tokens in the document
          const timeLiterals = lexResult.tokens.filter(
            (token) => token.tokenType.name === 'TIME_LITERAL'
          );

          if (timeLiterals.length > 0) {
            lineInfo = timeLiterals
              .map((token) => `line ${token.startLine}:${token.startColumn}`)
              .join(', ');

            errorDetails = `Ambiguity with TIME_LITERAL tokens at ${lineInfo}. This might be related to time literals in function arguments.`;
          }
        } else if (error.message.includes('DIRECT_ADDRESS')) {
          // Find DIRECT_ADDRESS tokens in the document
          const directAddresses = lexResult.tokens.filter(
            (token) => token.tokenType.name === 'DIRECT_ADDRESS'
          );

          if (directAddresses.length > 0) {
            lineInfo = directAddresses
              .map((token) => `line ${token.startLine}:${token.startColumn}`)
              .join(', ');

            errorDetails = `Ambiguity with DIRECT_ADDRESS tokens at ${lineInfo}. This might be related to direct addressing in function arguments.`;
          }
        } else if (error.message.includes('functionCall')) {
          errorDetails = `Error parsing function calls. This might be related to timer function calls like TON, TOF, or TP. Check that all function calls have proper argument lists.`;
        }

        return {
          success: false,
          ast: undefined,
          diagnostics: [
            {
              severity: 'error',
              message: errorDetails,
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          ],
        };
      }

      // Handle statement errors specifically
      if (
        error instanceof Error &&
        error.message.includes('Unknown statement type')
      ) {
        return {
          success: false,
          ast: undefined,
          diagnostics: [
            {
              severity: 'error',
              message: `Error processing statement. This might be related to timer function calls (TON, TOF, TP). Make sure timer instances are properly declared as variables and used with proper function call syntax.`,
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          ],
        };
      }

      // Re-throw for general error handler
      throw error;
    }
  } catch (error) {
    console.error('Unhandled compiler error:', error);

    // Handle any unexpected errors
    return {
      success: false,
      ast: undefined,
      diagnostics: [
        {
          severity: 'error',
          message: `Unhandled compiler error: ${
            error instanceof Error ? error.message : String(error)
          }`,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
        },
      ],
    };
  }
}
