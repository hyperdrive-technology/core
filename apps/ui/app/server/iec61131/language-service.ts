import languageConfiguration from './language-configuration.json';

// Define language ID
export const IEC61131_LANGUAGE_ID = 'iec61131';

// Register the IEC 61131-3 language
export function registerIEC61131Language(monaco: any) {
  // Register the language with Monaco
  monaco.languages.register({
    id: IEC61131_LANGUAGE_ID,
    extensions: ['.st'],
    aliases: ['IEC61131', 'Structured Text', 'ST'],
    mimetypes: ['text/x-st'],
  });

  // Set the language configuration (brackets, comments, etc.)
  monaco.languages.setLanguageConfiguration(
    IEC61131_LANGUAGE_ID,
    languageConfiguration,
  );

  // Define the token provider for syntax highlighting
  monaco.languages.setMonarchTokensProvider(IEC61131_LANGUAGE_ID, {
    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: 'invalid',

    // IEC 61131-3 keywords
    keywords: [
      'PROGRAM',
      'END_PROGRAM',
      'FUNCTION',
      'END_FUNCTION',
      'FUNCTION_BLOCK',
      'END_FUNCTION_BLOCK',
      'VAR',
      'VAR_INPUT',
      'VAR_OUTPUT',
      'END_VAR',
      'STRUCT',
      'END_STRUCT',
      'ARRAY',
      'OF',
      'BEGIN',
      'END',
      'IF',
      'THEN',
      'ELSE',
      'ELSIF',
      'END_IF',
      'CASE',
      'END_CASE',
      'FOR',
      'TO',
      'BY',
      'DO',
      'END_FOR',
      'WHILE',
      'END_WHILE',
      'REPEAT',
      'UNTIL',
      'END_REPEAT',
      'RETURN',
      'EXIT',
      'AND',
      'OR',
      'XOR',
      'NOT',
      'MOD',
    ],

    // IEC 61131-3 data types
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
      'TIME_OF_DAY',
      'TOD',
      'DATE_AND_TIME',
      'DT',
      'STRING',
      'WSTRING',
    ],

    // Operators
    operators: ['=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', ':=', '.'],

    // Symbols
    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    // Escapes
    escapes:
      /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // Identifiers and keywords
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          },
        ],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [
          /@symbols/,
          {
            cases: {
              '@operators': 'operator',
              '@default': '',
            },
          },
        ],

        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],

        // String
        [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-terminated string
        [/'/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
        [
          /"/,
          { token: 'string.quote', bracket: '@open', next: '@doubleString' },
        ],
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\/.*$/, 'comment'],
        [/\(\*/, { token: 'comment', next: '@multiLineComment' }],
      ],

      multiLineComment: [
        [/[^\*]+/, 'comment'],
        [/\*\)/, { token: 'comment', next: '@pop' }],
        [/\*/, 'comment'],
      ],

      string: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],

      doubleString: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });
}
