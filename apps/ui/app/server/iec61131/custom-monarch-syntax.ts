import { languages } from 'monaco-editor';
import generatedMonarchSyntax from './generated/monarch-syntax';

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
