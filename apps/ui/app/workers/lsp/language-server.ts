import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  InitializeParams,
  InitializeResult,
  MarkupKind,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/browser';

/**
 * Start the language server with the given connection
 */
export function startLanguageServer(connection: Connection): void {
  // Create text documents collection
  const documents = new TextDocuments(TextDocument);
  documents.listen(connection);

  connection.onInitialize((_params: InitializeParams): InitializeResult => {
    // Define server capabilities
    const capabilities: ServerCapabilities = {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: ['.', ':'],
        resolveProvider: true,
      },
      hoverProvider: true,
      documentFormattingProvider: true,
      definitionProvider: true,
      referencesProvider: true,
    };

    return {
      capabilities,
      serverInfo: {
        name: 'IEC 61131-3 Language Server',
        version: '1.0.0',
      },
    };
  });

  // Set up document validation using a simple implementation
  documents.onDidChangeContent(async (change) => {
    const document = change.document;
    const uri = document.uri;

    try {
      // Simple validation for now - this would use a Langium validator in a full implementation
      const diagnostics = validateDocument(document.getText());
      connection.sendDiagnostics({ uri, diagnostics });
    } catch (error) {
      console.error('Error validating document:', error);
    }
  });

  // Set up completion provider
  connection.onCompletion((params) => {
    try {
      // Simple completion implementation
      return getCompletions(params.textDocument.uri, params.position);
    } catch (error) {
      console.error('Error providing completions:', error);
      return [];
    }
  });

  // Set up formatting provider
  connection.onDocumentFormatting((params) => {
    try {
      // Get the document
      const document = documents.get(params.textDocument.uri);
      if (!document) return [];

      // Simple formatting implementation
      return formatDocument(document.getText());
    } catch (error) {
      console.error('Error formatting document:', error);
      return [];
    }
  });

  // Set up hover provider
  connection.onHover((params) => {
    try {
      // Simple hover implementation
      return getHoverInfo(params.textDocument.uri, params.position);
    } catch (error) {
      console.error('Error providing hover info:', error);
      return null;
    }
  });

  // Start listening
  connection.listen();
}

// Simplified validation function
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

// Simplified completion provider
function getCompletions(
  _uri: string,
  _position: { line: number; character: number },
): CompletionItem[] {
  // Return some basic IEC 61131-3 keywords for completion
  return [
    { label: 'PROGRAM', kind: CompletionItemKind.Keyword },
    { label: 'END_PROGRAM', kind: CompletionItemKind.Keyword },
    { label: 'FUNCTION', kind: CompletionItemKind.Keyword },
    { label: 'END_FUNCTION', kind: CompletionItemKind.Keyword },
    { label: 'FUNCTION_BLOCK', kind: CompletionItemKind.Keyword },
    { label: 'END_FUNCTION_BLOCK', kind: CompletionItemKind.Keyword },
    { label: 'VAR', kind: CompletionItemKind.Keyword },
    { label: 'END_VAR', kind: CompletionItemKind.Keyword },
    { label: 'IF', kind: CompletionItemKind.Keyword },
    { label: 'THEN', kind: CompletionItemKind.Keyword },
    { label: 'ELSE', kind: CompletionItemKind.Keyword },
    { label: 'END_IF', kind: CompletionItemKind.Keyword },
    { label: 'BOOL', kind: CompletionItemKind.TypeParameter },
    { label: 'INT', kind: CompletionItemKind.TypeParameter },
    { label: 'REAL', kind: CompletionItemKind.TypeParameter },
    { label: 'STRING', kind: CompletionItemKind.TypeParameter },
  ];
}

// Simplified hover provider
function getHoverInfo(
  _uri: string,
  _position: { line: number; character: number },
): Hover {
  // This would normally look up information about the symbol at the given position
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: 'IEC 61131-3 Language Server hover information',
    },
  };
}

// Simplified document formatter
function formatDocument(text: string) {
  const lines = text.split(/\r?\n/);
  const formattedLines = [];
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
    if (shouldHaveSemicolon(line) && !line.endsWith(';')) {
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
      range: {
        start: { line: 0, character: 0 },
        end: { line: lines.length, character: 0 },
      },
      newText: formatted,
    },
  ];
}

// Helper function to determine if a line should have a semicolon
function shouldHaveSemicolon(line: string): boolean {
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
