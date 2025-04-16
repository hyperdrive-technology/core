import { editor } from 'monaco-editor';
import { useEffect } from 'react';

/**
 * Hook to set up TypeScript/TSX language service in Monaco Editor
 * This is separate from the IEC-61131 language service to provide dedicated
 * support for React/TypeScript files.
 */
export function useTypeScriptLanguageClient(
  monaco: any,
  editorInstance: editor.IStandaloneCodeEditor | null
) {
  useEffect(() => {
    if (!monaco || !editorInstance) return;

    console.log('[TypeScript] Setting up TypeScript language service...');

    // Ensure languages are registered
    const registerLanguages = () => {
      // Make sure the typescript and typescriptreact languages are properly registered
      if (
        !monaco.languages
          .getLanguages()
          .some((lang: any) => lang.id === 'typescriptreact')
      ) {
        console.log('[TypeScript] Registering typescriptreact language');

        // Register the typescriptreact language if it doesn't exist
        monaco.languages.register({
          id: 'typescriptreact',
          extensions: ['.tsx'],
          aliases: ['TypeScript React', 'tsx'],
        });
      }
    };

    // Configure TypeScript language features
    const configureTypeScript = () => {
      // Enhanced diagnostics options
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
      });

      // Configure TypeScript compiler options for better React support
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        reactNamespace: 'React',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        strict: true,
        alwaysStrict: true,
        skipLibCheck: true,
        lib: ['DOM', 'DOM.Iterable', 'ESNext'],
      });

      // Make sure JSX is also enabled for .tsx files
      monaco.languages.typescript.typescriptDefaults.setModeConfiguration({
        completionItems: true,
        hovers: true,
        documentSymbols: true,
        definitions: true,
        references: true,
        documentHighlights: true,
        rename: true,
        diagnostics: true,
        documentFormattingEdits: true,
        signatureHelp: true,
        smartIndent: true,
        suggestBeforeChar: true,
      });

      // Add React typings
      addTypeDefinitions(monaco);
    };

    // Add basic React type definitions
    const addTypeDefinitions = (monaco: any) => {
      // Simplified React type definitions
      const reactTypes = `
        declare module "react" {
          export = React;
        }

        declare namespace React {
          interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {}

          type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;

          interface FunctionComponent<P = {}> {
            (props: P, context?: any): ReactElement<any, any> | null;
            displayName?: string;
          }

          interface FC<P = {}> extends FunctionComponent<P> {}

          interface ComponentClass<P = {}, S = any> {
            new(props: P, context?: any): Component<P, S>;
            displayName?: string;
          }

          class Component<P = {}, S = {}> {
            constructor(props: P, context?: any);
            props: Readonly<P>;
            state: Readonly<S>;
            setState(state: S | ((prevState: S, props: P) => S), callback?: () => void): void;
            render(): ReactElement | null;
          }

          interface PropsWithChildren<P = unknown> {
            children?: ReactNode | undefined;
          }

          type ReactNode = ReactElement | string | number | boolean | null | undefined;

          type JSXElementConstructor<P> = ((props: P) => ReactElement<any, any> | null) | (new (props: P) => Component<P, any>);

          function createElement(type: any, props?: any, ...children: any[]): ReactElement;
          function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
          function useEffect(effect: () => (void | (() => void)), deps?: any[]): void;
          function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          function useMemo<T>(factory: () => T, deps: any[]): T;
          function useRef<T>(initialValue: T): { current: T };
          function Fragment(props: { children?: ReactNode }): ReactElement | null;
        }

        declare global {
          namespace JSX {
            interface Element extends React.ReactElement<any, any> {}
            interface ElementAttributesProperty { props: {}; }
            interface ElementChildrenAttribute { children: {}; }
            interface IntrinsicElements {
              div: any;
              span: any;
              h1: any;
              h2: any;
              h3: any;
              p: any;
              a: any;
              button: any;
              input: any;
              form: any;
              [elemName: string]: any;
            }
          }
        }
      `;

      // Add extra lib declaration
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );

      // CSS module declarations for TypeScript
      const cssModuleTypes = `
        declare module '*.module.css' {
          const classes: { [key: string]: string };
          export default classes;
        }
      `;

      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        cssModuleTypes,
        'file:///node_modules/@types/css-modules.d.ts'
      );

      // Additional declarations for common libraries
      const tailwindTypes = `
        declare module 'tailwindcss' {
          const tailwind: any;
          export default tailwind;
        }
      `;

      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        tailwindTypes,
        'file:///node_modules/@types/tailwindcss/index.d.ts'
      );

      console.log('[TypeScript] Type definitions added');
    };

    // Add TypeScript code completion for basic React patterns
    const setupCodeCompletions = (monaco: any) => {
      // React code snippets for TypeScript files
      monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // Only provide completions for TypeScript/TSX files
          const filename = model.uri.path;
          if (!filename.endsWith('.ts') && !filename.endsWith('.tsx')) {
            return { suggestions: [] };
          }

          // Common React snippets
          const suggestions = [
            {
              label: 'useState',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
                'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialState});',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'React useState hook',
              range,
            },
            {
              label: 'useEffect',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
                'useEffect(() => {\n\t${1}\n\treturn () => {\n\t\t${2}\n\t};\n}, [${3}]);',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'React useEffect hook with cleanup',
              range,
            },
            {
              label: 'fc',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
                'function ${1:Component}(${2:props}) {\n\treturn (\n\t\t<div>\n\t\t\t${3}\n\t\t</div>\n\t);\n}',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'React functional component',
              range,
            },
            {
              label: 'useCallback',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
                'const ${1:callback} = useCallback((${2:params}) => {\n\t${3}\n}, [${4}]);',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'React useCallback hook',
              range,
            },
          ];

          return { suggestions };
        },
      });

      // Register the same completions for typescriptreact language
      monaco.languages.registerCompletionItemProvider('typescriptreact', {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // Common React snippets
          return {
            suggestions: [
              {
                label: 'useState',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialState});',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'React useState hook',
                range,
              },
              {
                label: 'useEffect',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'useEffect(() => {\n\t${1}\n\treturn () => {\n\t\t${2}\n\t};\n}, [${3}]);',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'React useEffect hook with cleanup',
                range,
              },
              {
                label: 'fc',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  'function ${1:Component}(${2:props}) {\n\treturn (\n\t\t<div>\n\t\t\t${3}\n\t\t</div>\n\t);\n}',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'React functional component',
                range,
              },
            ],
          };
        },
      });

      console.log('[TypeScript] Code completions registered');
    };

    // Listen for model changes
    const setupModelListeners = () => {
      monaco.editor.onDidCreateModel((model: any) => {
        const uri = model.uri.toString();
        if (uri.endsWith('.tsx') || uri.endsWith('.jsx')) {
          console.log(`[TypeScript] Detected TypeScript/TSX file: ${uri}`);

          // Explicitly set .tsx files to use typescriptreact language mode
          if (uri.endsWith('.tsx')) {
            monaco.editor.setModelLanguage(model, 'typescriptreact');
            console.log(
              `[TypeScript] Set language mode to typescriptreact for ${uri}`
            );
          } else if (uri.endsWith('.jsx')) {
            monaco.editor.setModelLanguage(model, 'javascriptreact');
            console.log(
              `[TypeScript] Set language mode to javascriptreact for ${uri}`
            );
          }
        }
      });
    };

    // Update language for existing models
    const updateExistingModels = () => {
      const models = monaco.editor.getModels();
      models.forEach((model: any) => {
        const uri = model.uri.toString();
        if (uri.endsWith('.tsx')) {
          monaco.editor.setModelLanguage(model, 'typescriptreact');
          console.log(
            `[TypeScript] Updated existing model to typescriptreact: ${uri}`
          );
        } else if (uri.endsWith('.jsx')) {
          monaco.editor.setModelLanguage(model, 'javascriptreact');
          console.log(
            `[TypeScript] Updated existing model to javascriptreact: ${uri}`
          );
        }
      });
    };

    // Fix any existing models that may have been loaded before our configuration
    const refreshModels = () => {
      const models = monaco.editor.getModels();
      for (const model of models) {
        const uri = model.uri.toString();

        // Force refresh of the model to apply new settings
        if (uri.endsWith('.tsx')) {
          console.log(`[TypeScript] Refreshing model: ${uri}`);

          // Save the content
          const content = model.getValue();

          // Recreate the model with the correct settings
          model.dispose();

          // Create a new model with the same content
          const newModel = monaco.editor.createModel(
            content,
            'typescriptreact',
            monaco.Uri.parse(uri)
          );

          // If this was the current model in the editor, set it again
          if (editorInstance.getModel()?.uri.toString() === uri) {
            editorInstance.setModel(newModel);
          }
        }
      }
    };

    // Add custom JSX syntax highlighting
    const ensureJsxHighlighting = () => {
      try {
        // If the internal token provider is accessible, use it
        if (monaco.languages.setMonarchTokensProvider) {
          // This is a simplified JSX token provider that adds basic highlighting
          const jsxTokens = {
            defaultToken: 'invalid',
            tokenPostfix: '.tsx',

            keywords: [
              'abstract',
              'as',
              'break',
              'case',
              'catch',
              'class',
              'continue',
              'const',
              'constructor',
              'debugger',
              'declare',
              'default',
              'delete',
              'do',
              'else',
              'enum',
              'export',
              'extends',
              'false',
              'finally',
              'for',
              'from',
              'function',
              'get',
              'if',
              'implements',
              'import',
              'in',
              'infer',
              'instanceof',
              'interface',
              'is',
              'keyof',
              'let',
              'module',
              'namespace',
              'never',
              'new',
              'null',
              'number',
              'object',
              'package',
              'private',
              'protected',
              'public',
              'readonly',
              'return',
              'set',
              'static',
              'string',
              'super',
              'switch',
              'symbol',
              'this',
              'throw',
              'true',
              'try',
              'type',
              'typeof',
              'unique',
              'var',
              'void',
              'while',
              'with',
              'yield',
            ],

            typeKeywords: [
              'any',
              'boolean',
              'number',
              'object',
              'string',
              'undefined',
            ],

            brackets: [
              { open: '{', close: '}', token: 'delimiter.curly' },
              { open: '[', close: ']', token: 'delimiter.square' },
              { open: '(', close: ')', token: 'delimiter.parenthesis' },
              { open: '<', close: '>', token: 'delimiter.angle' },
            ],

            tokenizer: {
              root: [
                { include: '@whitespace' },
                { include: '@comment' },
                { include: '@strings' },
                { include: '@jsx' },

                // identifiers and keywords
                [
                  /[a-zA-Z_$][\w$]*/,
                  {
                    cases: {
                      '@keywords': 'keyword',
                      '@typeKeywords': 'keyword.type',
                      '@default': 'identifier',
                    },
                  },
                ],

                // punctuation
                [/[{}()\[\]]/, '@brackets'],
                [/[<>](?!@brackets)/, '@brackets'],
                [/[;,.]/, 'delimiter'],

                // numbers
                [/\d+/, 'number'],
              ],

              // JSX
              jsx: [
                [
                  /<(\w+)/,
                  {
                    token: 'tag',
                    next: '@jsxAttrs',
                    nextEmbedded: 'text/html',
                  },
                ],
                [/<\/(\w+)/, { token: 'tag', next: '@jsxClose' }],
              ],

              jsxAttrs: [
                [/\w+/, 'attribute.name'],
                [/=/, 'delimiter'],
                [/"([^"]*)"/, 'attribute.value'],
                [/'([^']*)'/, 'attribute.value'],
                [
                  />/,
                  { token: 'delimiter', next: '@pop', nextEmbedded: '@pop' },
                ],
              ],

              jsxClose: [[/>/, { token: 'delimiter', next: '@pop' }]],

              whitespace: [[/[ \t\r\n]+/, 'white']],

              comment: [
                [/\/\/.*$/, 'comment'],
                [/\/\*/, 'comment', '@commentBody'],
              ],

              commentBody: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[/*]/, 'comment'],
              ],

              strings: [
                [/'([^'\\]|\\.)*$/, 'string.invalid'],
                [/"([^"\\]|\\.)*$/, 'string.invalid'],
                [/'/, 'string', '@stringBody'],
                [/"/, 'string', '@dblStringBody'],
              ],

              stringBody: [
                [/[^\\']+/, 'string'],
                [/\\./, 'string.escape'],
                [/'/, 'string', '@pop'],
              ],

              dblStringBody: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, 'string', '@pop'],
              ],
            },
          };

          monaco.languages.setMonarchTokensProvider(
            'typescriptreact',
            jsxTokens
          );
          console.log('[TypeScript] Added custom JSX syntax highlighting');
        }
      } catch (error) {
        console.error('[TypeScript] Error setting up JSX highlighting:', error);
      }
    };

    // Execute setup steps in order
    registerLanguages();
    configureTypeScript();
    setupCodeCompletions(monaco);
    setupModelListeners();
    updateExistingModels();
    ensureJsxHighlighting();

    // Call refresh after a short delay to ensure configuration is complete
    setTimeout(refreshModels, 500);
  }, [monaco, editorInstance]);
}

export default useTypeScriptLanguageClient;
