// This is a simplified worker for language processing
// In a real implementation, you would integrate with Langium and monaco-languageclient

// Define Diagnostic interface
interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity: number; // 1: Error, 2: Warning, 3: Info, 4: Hint
}

// Worker message handler
self.onmessage = (event) => {
  console.log('Worker received message:', event.data);

  // Process document changes and provide diagnostics
  if (event.data.type === 'documentChange') {
    const { uri, content } = event.data;
    const diagnostics: Diagnostic[] = [];

    // Check if this is a Structured Text (.st) file
    if (uri.endsWith('.st')) {
      // Apply IEC 61131-3 diagnostics
      applyIEC61131Diagnostics(content, diagnostics);
    } else {
      // Default diagnostics for other files
      // Example: flag console.log uses
      if (content.includes('console.log')) {
        const lineIndex = content.indexOf('console.log');
        const line = content.substring(0, lineIndex).split('\n').length - 1;
        const character = lineIndex - content.lastIndexOf('\n', lineIndex) - 1;

        diagnostics.push({
          range: {
            start: { line, character },
            end: { line, character: character + 'console.log'.length },
          },
          message: 'Avoid using console.log in production code',
          severity: 2, // Warning
        });
      }
    }

    // Send diagnostics back to main thread
    self.postMessage({
      type: 'diagnostics',
      uri,
      diagnostics,
    });
  }
};

// Apply IEC 61131-3 specific diagnostics
function applyIEC61131Diagnostics(content: string, diagnostics: Diagnostic[]) {
  // Check for common issues in ST code

  // 1. Check for variable declarations without data type
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('(*')) {
      return;
    }

    // Check for missing END_IF
    if (
      line.includes(' IF ') &&
      !line.includes('END_IF') &&
      !line.includes('ELSIF')
    ) {
      const nextLines = lines.slice(index + 1, index + 10).join('\n');
      if (!nextLines.includes('END_IF')) {
        diagnostics.push({
          range: {
            start: { line: index, character: line.indexOf('IF') },
            end: { line: index, character: line.indexOf('IF') + 2 },
          },
          message: 'IF statement might be missing END_IF',
          severity: 2, // Warning
        });
      }
    }

    // Check for variable declarations with missing type
    const varDeclMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
    if (varDeclMatch && !line.match(/:\s*[a-zA-Z0-9_]+/)) {
      diagnostics.push({
        range: {
          start: { line: index, character: line.indexOf(':') },
          end: { line: index, character: line.indexOf(':') + 1 },
        },
        message: 'Variable declaration missing data type',
        severity: 1, // Error
      });
    }
  });
}

// For TypeScript when using self in a Worker context
export {};
