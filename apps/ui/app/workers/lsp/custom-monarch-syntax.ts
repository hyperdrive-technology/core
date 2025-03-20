import { languages } from 'monaco-editor';
// Monarch syntax highlighting for the iec-61131 language.
export const generatedMonarchSyntax = {
  keywords: ['END_TYPE', 'TYPE'],
  operators: [],
  symbols: /(?:)/,

  tokenizer: {
    initial: [
      { regex: /FUNCTION_BLOCK/, action: { token: 'FUNCTION_BLOCK' } },
      { regex: /END_FUNCTION_BLOCK/, action: { token: 'END_FUNCTION_BLOCK' } },
      { regex: /VAR_INPUT/, action: { token: 'VAR_INPUT' } },
      { regex: /VAR_OUTPUT/, action: { token: 'VAR_OUTPUT' } },
      { regex: /VAR_IN_OUT/, action: { token: 'VAR_IN_OUT' } },
      { regex: /VAR_EXTERNAL/, action: { token: 'VAR_EXTERNAL' } },
      { regex: /VAR_GLOBAL/, action: { token: 'VAR_GLOBAL' } },
      { regex: /VAR_TEMP/, action: { token: 'VAR_TEMP' } },
      { regex: /END_PROGRAM/, action: { token: 'END_PROGRAM' } },
      { regex: /END_FUNCTION/, action: { token: 'END_FUNCTION' } },
      { regex: /END_WHILE/, action: { token: 'END_WHILE' } },
      { regex: /END_REPEAT/, action: { token: 'END_REPEAT' } },
      { regex: /END_STRUCT/, action: { token: 'END_STRUCT' } },
      { regex: /END_IF/, action: { token: 'END_IF' } },
      { regex: /END_FOR/, action: { token: 'END_FOR' } },
      { regex: /END_VAR/, action: { token: 'END_VAR' } },
      { regex: /END_CASE/, action: { token: 'END_CASE' } },
      { regex: /FUNCTION/, action: { token: 'FUNCTION' } },
      { regex: /PROGRAM/, action: { token: 'PROGRAM' } },
      { regex: /REPEAT/, action: { token: 'REPEAT' } },
      { regex: /STRUCT/, action: { token: 'STRUCT' } },
      { regex: /WHILE/, action: { token: 'WHILE' } },
      { regex: /ARRAY/, action: { token: 'ARRAY' } },
      { regex: /BEGIN/, action: { token: 'BEGIN' } },
      { regex: /ELSIF/, action: { token: 'ELSIF' } },
      { regex: /UNTIL/, action: { token: 'UNTIL' } },
      { regex: /ELSE/, action: { token: 'ELSE' } },
      { regex: /THEN/, action: { token: 'THEN' } },
      { regex: /CONSTANT/, action: { token: 'CONSTANT' } },
      { regex: /RETAIN/, action: { token: 'RETAIN' } },
      { regex: /VAR/, action: { token: 'VAR' } },
      { regex: /FOR/, action: { token: 'FOR' } },
      {
        regex: /END/,
        action: {
          cases: {
            '@keywords': { token: 'keyword' },
            '@default': { token: 'END' },
          },
        },
      },
      { regex: /IF/, action: { token: 'IF' } },
      { regex: /OF/, action: { token: 'OF' } },
      { regex: /TO/, action: { token: 'TO' } },
      { regex: /BY/, action: { token: 'BY' } },
      { regex: /DO/, action: { token: 'DO' } },
      { regex: /CASE/, action: { token: 'CASE' } },
      { regex: /RETURN/, action: { token: 'RETURN' } },
      { regex: /BOOL/, action: { token: 'BOOL' } },
      { regex: /BYTE/, action: { token: 'BYTE' } },
      { regex: /WORD/, action: { token: 'WORD' } },
      { regex: /DWORD/, action: { token: 'DWORD' } },
      { regex: /LWORD/, action: { token: 'LWORD' } },
      { regex: /SINT/, action: { token: 'SINT' } },
      { regex: /INT/, action: { token: 'INT' } },
      { regex: /DINT/, action: { token: 'DINT' } },
      { regex: /LINT/, action: { token: 'LINT' } },
      { regex: /USINT/, action: { token: 'USINT' } },
      { regex: /UINT/, action: { token: 'UINT' } },
      { regex: /UDINT/, action: { token: 'UDINT' } },
      { regex: /ULINT/, action: { token: 'ULINT' } },
      { regex: /REAL/, action: { token: 'REAL' } },
      { regex: /LREAL/, action: { token: 'LREAL' } },
      { regex: /TIME/, action: { token: 'TIME' } },
      { regex: /DATE/, action: { token: 'DATE' } },
      { regex: /TOD/, action: { token: 'TOD' } },
      { regex: /DT/, action: { token: 'DT' } },
      { regex: /STRING/, action: { token: 'STRING_TYPE' } },
      { regex: /WSTRING/, action: { token: 'WSTRING' } },
      { regex: /CHAR/, action: { token: 'CHAR' } },
      { regex: /WCHAR/, action: { token: 'WCHAR' } },
      { regex: /TON/, action: { token: 'TON' } },
      { regex: /TOF/, action: { token: 'TOF' } },
      { regex: /TP/, action: { token: 'TP' } },
      { regex: /TRUE/, action: { token: 'TRUE' } },
      { regex: /FALSE/, action: { token: 'FALSE' } },
      { regex: /NULL/, action: { token: 'NULL' } },
      { regex: /AND/, action: { token: 'AND' } },
      { regex: /OR/, action: { token: 'OR' } },
      { regex: /XOR/, action: { token: 'XOR' } },
      { regex: /NOT/, action: { token: 'NOT' } },
      { regex: /MOD/, action: { token: 'MOD' } },
      { regex: /ABS/, action: { token: 'ABS' } },
      { regex: /SQRT/, action: { token: 'SQRT' } },
      { regex: /LN/, action: { token: 'LN' } },
      { regex: /LOG/, action: { token: 'LOG' } },
      { regex: /EXP/, action: { token: 'EXP' } },
      { regex: /SIN/, action: { token: 'SIN' } },
      { regex: /COS/, action: { token: 'COS' } },
      { regex: /TAN/, action: { token: 'TAN' } },
      { regex: /ASIN/, action: { token: 'ASIN' } },
      { regex: /ACOS/, action: { token: 'ACOS' } },
      { regex: /ATAN/, action: { token: 'ATAN' } },
      { regex: /MIN/, action: { token: 'MIN' } },
      { regex: /MAX/, action: { token: 'MAX' } },
      { regex: /LIMIT/, action: { token: 'LIMIT' } },
      { regex: /LEN/, action: { token: 'LEN' } },
      { regex: /LEFT/, action: { token: 'LEFT' } },
      { regex: /RIGHT/, action: { token: 'RIGHT' } },
      { regex: /MID/, action: { token: 'MID' } },
      { regex: /CONCAT/, action: { token: 'CONCAT' } },
      { regex: /INSERT/, action: { token: 'INSERT' } },
      { regex: /DELETE/, action: { token: 'DELETE' } },
      { regex: /REPLACE/, action: { token: 'REPLACE' } },
      { regex: /FIND/, action: { token: 'FIND' } },
      { regex: /TIME_TO_REAL/, action: { token: 'TIME_TO_REAL' } },
      { regex: /16#[0-9A-Fa-f]+/, action: { token: 'HEX_NUMBER' } },
      { regex: /2#[01]+/, action: { token: 'BIN_NUMBER' } },
      { regex: /8#[0-7]+/, action: { token: 'OCT_NUMBER' } },
      { regex: /T#[0-9smhd_]+/, action: { token: 'TIME_LITERAL' } },
      { regex: /D#\d{4}-\d{1,2}-\d{1,2}/, action: { token: 'DATE_LITERAL' } },
      {
        regex: /[a-zA-Z_][a-zA-Z0-9_]*/,
        action: {
          cases: {
            '@keywords': { token: 'keyword' },
            '@default': { token: 'ID' },
          },
        },
      },
      {
        regex: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
        action: { token: 'number' },
      },
      { regex: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/, action: { token: 'string' } },
      { regex: /<=/, action: { token: 'LESS_EQUAL' } },
      { regex: />=/, action: { token: 'GREATER_EQUAL' } },
      { regex: /<>/, action: { token: 'NOT_EQUAL' } },
      { regex: /:=/, action: { token: 'ASSIGN' } },
      { regex: /=>/, action: { token: 'INIT' } },
      { regex: /\.\./, action: { token: 'RANGE' } },
      { regex: /=/, action: { token: 'EQUAL' } },
      { regex: /</, action: { token: 'LESS' } },
      { regex: />/, action: { token: 'GREATER' } },
      { regex: /\+/, action: { token: 'PLUS' } },
      { regex: /-/, action: { token: 'MINUS' } },
      { regex: /\*/, action: { token: 'MULTIPLY' } },
      { regex: /\//, action: { token: 'DIVIDE' } },
      { regex: /\./, action: { token: 'DOT' } },
      { regex: /,/, action: { token: 'COMMA' } },
      { regex: /;/, action: { token: 'SEMICOLON' } },
      { regex: /:/, action: { token: 'COLON' } },
      { regex: /\(/, action: { token: 'LPAREN' } },
      { regex: /\)/, action: { token: 'RPAREN' } },
      { regex: /\[/, action: { token: 'LBRACKET' } },
      { regex: /\]/, action: { token: 'RBRACKET' } },
      { include: '@whitespace' },
      {
        regex: /@symbols/,
        action: {
          cases: {
            '@operators': { token: 'operator' },
            '@default': { token: '' },
          },
        },
      },
    ],
    whitespace: [
      { regex: /\s+/, action: { token: 'white' } },
      { regex: /\(\*/, action: { token: 'comment', next: '@comment' } },
      { regex: /\/\/[^\n]*/, action: { token: 'comment' } },
    ],
    comment: [
      { regex: /[^\(\*]+/, action: { token: 'comment' } },
      { regex: /\*\)/, action: { token: 'comment', next: '@pop' } },
      { regex: /[\(\*]/, action: { token: 'comment' } },
    ],
  },
};

// Create an enhanced version by extending the generated syntax
export const monarchSyntax: languages.IMonarchLanguage = {
  // Start with the generated syntax
  ...generatedMonarchSyntax,

  // Override the defaultToken for better visualization
  defaultToken: 'identifier',

  // Define token categories
  keywords: [
    'PROGRAM',
    'END_PROGRAM',
    'FUNCTION',
    'END_FUNCTION',
    'FUNCTION_BLOCK',
    'END_FUNCTION_BLOCK',
    'VAR',
    'END_VAR',
    'VAR_INPUT',
    'VAR_OUTPUT',
    'VAR_IN_OUT',
    'VAR_EXTERNAL',
    'VAR_GLOBAL',
    'VAR_TEMP',
    'BEGIN',
    'END',
    'IF',
    'THEN',
    'ELSE',
    'ELSIF',
    'END_IF',
    'WHILE',
    'DO',
    'END_WHILE',
    'REPEAT',
    'UNTIL',
    'END_REPEAT',
    'FOR',
    'TO',
    'BY',
    'END_FOR',
    'ARRAY',
    'OF',
    'STRUCT',
    'END_STRUCT',
    'RETURN',
    'CASE',
    'END_CASE',
  ],

  // Define type keywords
  typeKeywords: [
    'BOOL',
    'BYTE',
    'WORD',
    'DWORD',
    'LWORD',
    'SINT',
    'INT',
    'DINT',
    'LINT',
    'USINT',
    'UINT',
    'UDINT',
    'ULINT',
    'REAL',
    'LREAL',
    'TIME',
    'DATE',
    'TOD',
    'DT',
    'STRING',
    'WSTRING',
    'CHAR',
    'WCHAR',
    'TON',
    'TOF',
    'TP',
  ],

  // Define operators
  operators: [
    'AND',
    'OR',
    'XOR',
    'NOT',
    'MOD',
    '=',
    '<>',
    '<',
    '>',
    '<=',
    '>=',
    '+',
    '-',
    '*',
    '/',
    ':=',
    '=>',
  ],

  // Define symbols
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  // Define constants
  constants: ['TRUE', 'FALSE', 'NULL'],

  // Define built-in functions
  builtinFunctions: [
    'ABS',
    'SQRT',
    'LN',
    'LOG',
    'EXP',
    'SIN',
    'COS',
    'TAN',
    'ASIN',
    'ACOS',
    'ATAN',
    'MIN',
    'MAX',
    'LIMIT',
    'LEN',
    'LEFT',
    'RIGHT',
    'MID',
    'CONCAT',
    'INSERT',
    'DELETE',
    'REPLACE',
    'FIND',
    'TIME_TO_REAL',
  ],

  // Define escapes
  escapes:
    /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  // Replace the tokenizer completely with our enhanced version
  tokenizer: {
    root: [
      // Comments first to ensure proper handling
      { include: '@whitespace' },

      // Function calls with variable names (like Tank1, Tank2)
      [/([a-zA-Z_]\w*)(\s*)(\()/, ['variable.function', 'white', '@brackets']],

      // Variable declarations with type (e.g., Level : REAL)
      [
        /([a-zA-Z_]\w*)(\s*)(:)(\s*)([A-Z][A-Z0-9_]*)/,
        ['variable.declaration', 'white', 'delimiter', 'white', 'type'],
      ],

      // Variable declarations with initialization (e.g., Level : REAL := 75.0)
      [
        /([a-zA-Z_]\w*)(\s*)(:)(\s*)([A-Z][A-Z0-9_]*)(\s*)(:=)/,
        [
          'variable.declaration',
          'white',
          'delimiter',
          'white',
          'type',
          'white',
          'operator.assignment',
        ],
      ],

      // Parameter assignments in function calls
      [
        /([a-zA-Z_]\w*)(\s*)(:=)/,
        ['parameter.name', 'white', 'operator.assignment'],
      ],

      // Operators - need to come before identifiers to catch word operators
      [/(:=|=>)/, 'operator.assignment'], // Special handling for assignment operators
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': 'delimiter',
          },
        },
      ],

      // Constants like TRUE/FALSE with dedicated token
      [/\b(TRUE|FALSE|NULL)\b/, 'constant'],

      // Identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@typeKeywords': 'type',
            '@keywords': 'keyword',
            '@constants': 'constant',
            '@operators': { token: 'operator.word' }, // Special styling for word operators
            '@builtinFunctions': 'predefined',
            '@default': 'variable.name', // Changed from 'identifier' to 'variable.name'
          },
        },
      ],

      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],

      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      [/16#[0-9A-Fa-f]+/, 'number.hex'], // Hexadecimal
      [/2#[01]+/, 'number.binary'], // Binary
      [/8#[0-7]+/, 'number.octal'], // Octal
      [/T#[0-9smhd_]+/, 'number.time'], // Time literals
      [/D#\d{4}-\d{1,2}-\d{1,2}/, 'number.date'], // Date literals

      // Delimiter: after number because of .\d
      [/[;,.]/, 'delimiter'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-terminated string
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\(\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],

    comment: [
      [/[^\(*]+/, 'comment'],
      [/\*\)/, 'comment', '@pop'],
      [/\(\*/, 'comment', '@push'],
      [/[\(*]/, 'comment'],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],
  },

  // Case insensitive tokenization
  ignoreCase: true,
};

export default monarchSyntax;
