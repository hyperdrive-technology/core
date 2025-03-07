/// <reference lib="webworker" />

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeTextDocumentParams,
  TextDocumentContentChangeEvent,
  TextDocuments,
} from 'vscode-languageserver/browser';

// Create a simple worker that just reports diagnostics
const connection = createConnection(
  new BrowserMessageReader(self as any),
  new BrowserMessageWriter(self as any),
);

// Create a text document manager
const documents = new TextDocuments(TextDocument);

// Define a simple IEC 61131-3 validator
connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: 1, // Full sync
      completionProvider: {
        triggerCharacters: ['.', ':'],
      },
      documentFormattingProvider: true,
    },
  };
});

// Listen for document changes
connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
  if (!params.contentChanges.length) return;

  const change: TextDocumentContentChangeEvent = params.contentChanges[0];
  const text = change.text;
  if (!text) return;

  const diagnostics = validateDocument(text);

  connection.sendDiagnostics({
    uri: params.textDocument.uri,
    diagnostics,
  });
});

// Listen for document open
connection.onDidOpenTextDocument((params) => {
  const { uri, text } = params.textDocument;
  const diagnostics = validateDocument(text);

  connection.sendDiagnostics({
    uri,
    diagnostics,
  });
});

// Simple validation function
function validateDocument(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = text.split(/\r?\n/);

  // Check for basic syntax issues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines and comments
    if (
      line.trim() === '' ||
      line.trim().startsWith('//') ||
      line.trim().startsWith('(*')
    ) {
      continue;
    }

    // Check for missing semicolons
    if (shouldHaveSemicolon(line) && !line.trim().endsWith(';')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: i, character: line.length },
          end: { line: i, character: line.length },
        },
        message: 'Missing semicolon at end of statement',
        source: 'iec61131-validator',
      });
    }
  }

  return diagnostics;
}

// Format document
connection.onDocumentFormatting((params) => {
  const { textDocument } = params;
  const text = documents.get(textDocument.uri)?.getText() || '';

  if (!text) return [];

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
      /\b(END_IF|END_WHILE|END_FOR|END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM)\b/i.test(
        line,
      )
    ) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add proper indentation
    const indent = '  '.repeat(indentLevel);

    // Add semicolon if needed
    if (shouldHaveSemicolon(line) && !line.endsWith(';')) {
      line += ';';
    }

    formattedLines.push(indent + line);

    // Handle indentation increases
    if (
      /\b(IF|WHILE|FOR|FUNCTION|FUNCTION_BLOCK|PROGRAM)\b/i.test(line) &&
      !/\bEND_/i.test(line)
    ) {
      indentLevel++;
    }
  }

  const formatted = formattedLines.join('\n');

  // Calculate the text edits
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: lines.length, character: 0 },
      },
      newText: formatted,
    },
  ];
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, uri, text } = event.data;

  if (type === 'validate' && uri && text) {
    // Validate the document
    const diagnostics = validateDocument(text);

    // Send diagnostics back to the main thread
    self.postMessage({
      uri,
      diagnostics,
    });
  }
});

// Helper function to determine if a line should have a semicolon
function shouldHaveSemicolon(line: string): boolean {
  // Trim the line and remove any existing semicolon
  const trimmed = line.trim().replace(/;$/, '');

  // Lines that shouldn't have semicolons
  if (
    /\b(IF|THEN|ELSE|END_IF|FUNCTION|END_FUNCTION|FUNCTION_BLOCK|END_FUNCTION_BLOCK|PROGRAM|END_PROGRAM|VAR|END_VAR)\b/i.test(
      trimmed,
    ) ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('(*') ||
    trimmed.endsWith('*)') ||
    trimmed === ''
  ) {
    return false;
  }

  // Everything else should have a semicolon
  return true;
}

// Start listening
documents.listen(connection);
connection.listen();

// Export nothing - this file is used as a worker
export default {};
