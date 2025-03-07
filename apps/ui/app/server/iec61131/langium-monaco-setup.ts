import * as monaco from 'monaco-editor';
import { editor, languages } from 'monaco-editor';
import { IEC61131LanguageMetaData } from '../../../src/generated/module';

// Define a type for the monarch tokens
interface MonarchDefinition {
  defaultToken: string;
  tokenPostfix?: string;
  ignoreCase?: boolean;
  keywords?: string[];
  tokenizer: Record<string, any[]>;
  [key: string]: any;
}

// Try to import the Langium-generated monarch syntax if available
let monarchTokens: MonarchDefinition;
try {
  // This path should match the output path defined in package.json for the monaco monarch syntax
  monarchTokens = require('./monarch-syntax.js').default;
} catch (e) {
  console.warn(
    'Langium-generated monarch syntax not found. Run "pnpm run langium:generate" to generate it.',
  );
  // Fallback to a simple syntax highlighting if the file isn't generated yet
  monarchTokens = {
    defaultToken: '',
    tokenPostfix: '.st',
    ignoreCase: true,
    keywords: ['IF', 'THEN', 'ELSE', 'END_IF', 'PROGRAM', 'END_PROGRAM'],
    tokenizer: {
      root: [
        [
          /[a-zA-Z_][\w$]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          },
        ],
        [/\/\/.*$/, 'comment'],
        [/\(\*/, 'comment', '@comment'],
        [/[;,.]/, 'delimiter'],
      ],
      comment: [
        [/[^\(*]+/, 'comment'],
        [/\*\)/, 'comment', '@pop'],
        [/\(\*/, 'comment', '@push'],
        [/./, 'comment'],
      ],
    },
  };
}

// Constants
const LANGUAGE_ID = IEC61131LanguageMetaData.languageId;
const WORKER_PATH = new URL('../../workers/langium-worker.js', import.meta.url)
  .href;

/**
 * Set up the Langium web worker for Monaco Editor
 */
export function setupLangiumMonaco(
  monaco: typeof import('monaco-editor'),
): void {
  // Register the language with Monaco
  monaco.languages.register({
    id: LANGUAGE_ID,
    extensions: ['.st'],
    aliases: ['IEC 61131-3', 'ST', 'Structured Text'],
  });

  // Set up the language configuration for better editing experience
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: {
      lineComment: '//',
      blockComment: ['(*', '*)'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern:
        /^\s*(IF|THEN|ELSE|ELSIF|CASE|FOR|WHILE|REPEAT|DO|FUNCTION|FUNCTION_BLOCK|PROGRAM|VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_TEMP|VAR_EXTERNAL|TYPE|STRUCT)\b/i,
      decreaseIndentPattern:
        /^\s*(END_IF|END_CASE|END_FOR|END_WHILE|END_REPEAT|END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM|END_VAR|END_TYPE|END_STRUCT)\b/i,
    },
    folding: {
      markers: {
        start: new RegExp(
          '^\\s*(IF|CASE|FOR|WHILE|REPEAT|FUNCTION|FUNCTION_BLOCK|PROGRAM)\\b',
          'i',
        ),
        end: new RegExp(
          '^\\s*(END_IF|END_CASE|END_FOR|END_WHILE|END_REPEAT|END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM)\\b',
          'i',
        ),
      },
    },
  });

  // Set up syntax highlighting using the Langium-generated monarch tokens
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarchTokens);

  // Set up language worker for validation
  setupLanguageWorker();

  // Add "Format Document" command
  addFormatCommand();
}

/**
 * Set up the language worker for validation
 */
function setupLanguageWorker(): void {
  console.log('Setting up Langium worker at', WORKER_PATH);

  // Register a simple message handler for the worker
  const worker = new Worker(WORKER_PATH);

  // Set up listener for diagnostic messages from the worker
  worker.onmessage = (e: MessageEvent) => {
    const { uri, diagnostics } = e.data;
    if (uri && diagnostics) {
      // Find the model for this URI
      const models = editor.getModels();
      for (const model of models) {
        if (model.uri.toString() === uri) {
          // Set markers in the editor
          editor.setModelMarkers(model, LANGUAGE_ID, diagnostics);
          break;
        }
      }
    }
  };

  // Function to send document to worker for validation
  const validateDocument = (model: editor.ITextModel) => {
    if (model.getLanguageId() === LANGUAGE_ID) {
      worker.postMessage({
        type: 'validate',
        uri: model.uri.toString(),
        text: model.getValue(),
      });
    }
  };

  // Process all open models
  const models = editor.getModels();
  models.forEach(validateDocument);

  // Set up content change listener for new models
  editor.onDidCreateModel(validateDocument);

  // Listen for content changes in existing models
  editor.getModels().forEach((model) => {
    if (model.getLanguageId() === LANGUAGE_ID) {
      model.onDidChangeContent(() => validateDocument(model));
    }
  });
}

/**
 * Add "Format Document" command to the editor
 */
function addFormatCommand(): void {
  // Register the command
  languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
    provideDocumentFormattingEdits: (model) => {
      return formatStructuredText(model);
    },
  });

  // Register a keybinding for the format command
  editor.addKeybindingRule({
    keybinding: monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
    command: 'editor.action.formatDocument',
    when: `editorLangId == ${LANGUAGE_ID}`,
  });
}

/**
 * Format a Structured Text document
 */
function formatStructuredText(model: editor.ITextModel): languages.TextEdit[] {
  const text = model.getValue();
  const lines = text.split(/\r?\n/);
  const formattedLines: string[] = [];
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines
    if (line === '') {
      formattedLines.push('');
      continue;
    }

    // Handle indentation decreases
    if (
      /\b(END_IF|END_WHILE|END_FOR|END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM|END_VAR|END_TYPE|END_STRUCT)\b/i.test(
        line,
      )
    ) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add proper indentation
    const indent = '  '.repeat(indentLevel);

    // Add semicolon if needed
    if (needsSemicolon(line) && !line.endsWith(';')) {
      line += ';';
    }

    formattedLines.push(indent + line);

    // Handle indentation increases
    if (
      /\b(IF|THEN|ELSE|WHILE|FOR|FUNCTION|FUNCTION_BLOCK|PROGRAM|VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|TYPE|STRUCT)\b/i.test(
        line,
      ) &&
      !/\b(END_|THEN|ELSE|DO)\b/i.test(line)
    ) {
      indentLevel++;
    }
  }

  const formatted = formattedLines.join('\n');

  // Return the formatting edits
  return [
    {
      range: model.getFullModelRange(),
      text: formatted,
    },
  ];
}

/**
 * Check if a line needs a semicolon
 */
function needsSemicolon(line: string): boolean {
  // Trim the line and remove any existing semicolon
  const trimmed = line.trim().replace(/;$/, '');

  // Lines that shouldn't have semicolons
  if (
    /\b(IF|THEN|ELSE|ELSIF|END_IF|CASE|OF|END_CASE|FOR|TO|BY|DO|END_FOR|WHILE|END_WHILE|REPEAT|UNTIL|END_REPEAT|FUNCTION|END_FUNCTION|FUNCTION_BLOCK|END_FUNCTION_BLOCK|PROGRAM|END_PROGRAM|VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|END_VAR|TYPE|END_TYPE|STRUCT|END_STRUCT)\b/i.test(
      trimmed,
    ) ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('(*') ||
    trimmed.endsWith('*)') ||
    trimmed === ''
  ) {
    return false;
  }

  // Check statements that should have semicolons
  if (
    /:=/.test(trimmed) || // Assignment
    /[A-Za-z_]\w*\s*\(/.test(trimmed) || // Function call
    /\bRETURN\b/i.test(trimmed) || // RETURN statement
    /[+\-*\/=<>]/.test(trimmed) // Operators
  ) {
    return true;
  }

  // Default to requiring semicolons
  return true;
}
