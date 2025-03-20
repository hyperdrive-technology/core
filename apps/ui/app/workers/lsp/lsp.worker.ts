/// <reference lib="webworker" />

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeTextDocumentParams,
  InitializeParams,
  InitializeResult,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/browser';
import { IEC61131Parser } from '../iec61131/parser';
import { IEC61131Visitor } from '../iec61131/visitor';

try {
  // Initialize the parser and visitor
  const parser = new IEC61131Parser();
  const visitor = new IEC61131Visitor();

  // Create a connection for the server
  console.log('Initializing LSP connection...');
  const connection = createConnection(
    new BrowserMessageReader(self as DedicatedWorkerGlobalScope),
    new BrowserMessageWriter(self as DedicatedWorkerGlobalScope)
  );

  // Create a text document manager
  const documents = new TextDocuments(TextDocument);

  // Initialize the language server
  connection.onInitialize((params: InitializeParams): InitializeResult => {
    console.log('Language server initializing...', params);
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        completionProvider: {
          triggerCharacters: ['.', ':'],
        },
        documentFormattingProvider: true,
      },
    };
  });

  // Handle document changes
  connection.onDidChangeTextDocument(
    async (params: DidChangeTextDocumentParams) => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return;

      try {
        // Parse the document
        const lexResult = parser.lexer.tokenize(document.getText());
        const diagnostics: Diagnostic[] = [];

        // Add lexer errors
        lexResult.errors.forEach((error) => {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: {
                line: (error.line || 1) - 1,
                character: (error.column || 1) - 1,
              },
              end: {
                line: (error.line || 1) - 1,
                character: (error.column || 1) + (error.length || 1) - 1,
              },
            },
            message: `Lexer error: ${error.message}`,
            source: 'iec61131-lsp',
          });
        });

        if (lexResult.errors.length === 0) {
          // Parse tokens
          parser.input = lexResult.tokens;
          const cst = parser.program();

          // Add parser errors
          parser.errors.forEach((error) => {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: {
                  line: (error.token.startLine || 1) - 1,
                  character: (error.token.startColumn || 1) - 1,
                },
                end: {
                  line: (error.token.endLine || 1) - 1,
                  character: (error.token.endColumn || 1) - 1,
                },
              },
              message: `Parser error: ${error.message}`,
              source: 'iec61131-lsp',
            });
          });

          // If parsing succeeded, try semantic analysis
          if (parser.errors.length === 0) {
            try {
              visitor.visit(cst);
            } catch (error) {
              diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 1 },
                },
                message: `Semantic error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
                source: 'iec61131-lsp',
              });
            }
          }
        }

        // Send the diagnostics
        connection.sendDiagnostics({
          uri: document.uri,
          diagnostics,
        });
      } catch (error) {
        console.error('Error in LSP worker:', error);
        connection.sendDiagnostics({
          uri: document.uri,
          diagnostics: [
            {
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
              message: `LSP error: ${
                error instanceof Error ? error.message : String(error)
              }`,
              source: 'iec61131-lsp',
            },
          ],
        });
      }
    }
  );

  // Handle document formatting
  connection.onDocumentFormatting(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const lines = text.split(/\r?\n/);
    let indentLevel = 0;
    const formattedLines: string[] = [];

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
          line
        )
      ) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add proper indentation
      const indent = '  '.repeat(indentLevel);
      formattedLines.push(indent + line);

      // Handle indentation increases
      if (
        /\b(IF|WHILE|FOR|FUNCTION|FUNCTION_BLOCK|PROGRAM|VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|TYPE|STRUCT)\b/i.test(
          line
        ) &&
        !/\bEND_/i.test(line)
      ) {
        indentLevel++;
      }
    }

    // Return the formatting changes
    return [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: lines.length, character: 0 },
        },
        newText: formattedLines.join('\n'),
      },
    ];
  });

  // Listen on the connection
  documents.listen(connection);
  connection.listen();

  console.log('Language server started successfully');
} catch (error) {
  console.error('Failed to start language server:', error);
  throw error;
}

// Export nothing - this file is used as a worker
export default {};
