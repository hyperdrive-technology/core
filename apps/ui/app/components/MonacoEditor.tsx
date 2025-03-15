import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { ChevronLeft, ChevronRight, File, X } from 'lucide-react';
import { editor } from 'monaco-editor';
import { Resizable } from 're-resizable';
import {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  IEC61131_LANGUAGE_ID,
  registerIEC61131Language,
} from '../server/iec61131/language-service';
import { CommandBar } from './CommandBar';
import { useWebSocket } from './context/WebSocketContext';
import { TabType } from './EditorTab';
import NewFileDialog from './NewFileDialog';
import ProjectSidebar from './ProjectSidebar/ProjectSidebar';
import StatusScreen from './StatusScreen';
import TrendsTab from './TrendsTab';
import { FileNode } from './types';

// Custom error boundary for the editor
class EditorErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Editor error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md m-4">
          <h3 className="font-bold mb-2">
            Something went wrong with the editor
          </h3>
          <p className="mb-4">
            The editor encountered an error and could not be displayed.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Tab Component (rename to LocalEditorTab to avoid naming conflicts)
const LocalEditorTab: React.FC<{
  file: FileNode;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  hasUnsavedChanges: boolean;
  tabType?: TabType;
}> = ({ file, isActive, onClick, onClose, hasUnsavedChanges }) => {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={cn(
        'flex items-center px-3 py-2 border-r dark:border-gray-700 cursor-pointer select-none',
        isActive
          ? ' bg-white dark:bg-gray-800 border-b-2 border-b-blue-500 pb-[6px]'
          : 'bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800'
      )}
      onClick={onClick}
    >
      <File size={14} className="mr-2 text-gray-500" />
      <span className="mr-2">
        {file.name}
        {hasUnsavedChanges && (
          <span
            className="inline-block mb-[1px] ml-1.5 h-2 w-2 rounded-full bg-gray-900 dark:bg-gray-100"
            title="Unsaved changes"
          />
        )}
      </span>
      <X
        size={14}
        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        onClick={handleClose}
      />
    </div>
  );
};

// Update the component to accept initialFiles prop
interface MonacoEditorProps {
  initialFiles?: FileNode[];
  projectName?: string; // Add optional project name prop
}

const MonacoEditor = ({ initialFiles, projectName }: MonacoEditorProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [files, setFiles] = useState<FileNode[]>(initialFiles ?? []);
  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Dialog states
  const [fileDialog, setFileDialog] = useState({
    isOpen: false,
    isFolder: false,
    parentNode: null as FileNode | null,
  });

  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    node: null as FileNode | null,
  });

  // Navigation history state
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navPosition, setNavPosition] = useState(-1);
  const [connected, setConnected] = useState(false);

  // State for tracking unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // State for tracking which files have unsaved changes
  const [unsavedFileIds, setUnsavedFileIds] = useState<Set<string>>(new Set());

  // Add a state for tracking the current project/folder
  // Use provided projectName from props if available, otherwise default
  const [currentProjectName, setCurrentProjectName] = useState<string>(
    projectName || 'Hyperdrive Project'
  );

  // Keep a reference to whether we have a prop-provided project name
  const hasProjectNameProp = useRef(!!projectName);

  // Update currentProjectName if projectName prop changes
  useEffect(() => {
    if (projectName) {
      setCurrentProjectName(projectName);
      hasProjectNameProp.current = true;
    }
  }, [projectName]);

  // Detect project name from folders when component mounts
  useEffect(() => {
    // Skip if we have a project name from props
    if (hasProjectNameProp.current) {
      return;
    }

    // Check if we have the example project structure
    const hasDevicesFolder = files.some(
      (file) => file.isFolder && file.name.toLowerCase() === 'devices'
    );
    const hasLogicFolder = files.some(
      (file) => file.isFolder && file.name.toLowerCase() === 'logic'
    );
    const hasControlFolder = files.some(
      (file) => file.isFolder && file.name.toLowerCase() === 'control'
    );

    // If we have the standard project structure, set the project name to "Example 1"
    if (hasDevicesFolder && hasLogicFolder && hasControlFolder) {
      setCurrentProjectName('Example 1');
    }
  }, [files, projectName]); // This will run when files change, but only set the name once

  // Add another useEffect that runs to detect file IDs if they contain example paths
  useEffect(() => {
    // Skip if we have a project name from props
    if (hasProjectNameProp.current) {
      return;
    }

    // Try to directly look for "example-1" in file paths
    for (const file of files) {
      if (file.id && typeof file.id === 'string') {
        if (
          file.id.includes('example-1') ||
          file.id.includes('examples/example-1')
        ) {
          setCurrentProjectName('Example 1');
          break;
        }
      }
    }
  }, [files]);

  // Auto-open the first file from initialFiles if provided
  useEffect(() => {
    if (
      initialFiles &&
      initialFiles.length > 0 &&
      editorReady &&
      !activeFileId
    ) {
      // Find the first file (not folder) in the tree
      const findFirstFile = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (!node.isFolder) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const firstFile = findFirstFile(node.children);
            if (firstFile) {
              return firstFile;
            }
          }
        }
        return null;
      };

      const firstFile = findFirstFile(initialFiles);
      if (firstFile) {
        handleSelectFile(firstFile);
      }
    }
  }, [initialFiles, editorReady]);

  // Get the current theme from the DOM to avoid SSR issues
  const getCurrentTheme = () => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
        ? 'vs-dark'
        : 'vs';
    }
    return 'vs'; // Default to light theme for SSR
  };

  const [monacoTheme, setMonacoTheme] = useState(getCurrentTheme());

  // Update Monaco theme when the document theme changes
  useEffect(() => {
    const updateMonacoTheme = () => {
      const newTheme = document.documentElement.classList.contains('dark')
        ? 'vs-dark'
        : 'vs';
      setMonacoTheme(newTheme);

      // Update the editor theme if it exists
      if (monacoRef.current && editorRef.current) {
        monacoRef.current.editor.setTheme(newTheme);
      }
    };

    // Set initial theme
    updateMonacoTheme();

    // Create a mutation observer to watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.attributeName === 'class' &&
          mutation.target === document.documentElement
        ) {
          updateMonacoTheme();
        }
      });
    });

    // Start observing
    observer.observe(document.documentElement, { attributes: true });

    // Clean up
    return () => observer.disconnect();
  }, []);

  // Handle displaying file content in the editor
  const displayFileInEditor = useCallback(
    (file: FileNode) => {
      if (!editorRef.current || !monacoRef.current || !editorReady) {
        console.log('Editor not ready yet, skipping displayFileInEditor');
        return;
      }

      // Check if editor's DOM node is available
      if (!editorRef.current.getDomNode()) {
        console.log(
          'Editor DOM node not available, skipping displayFileInEditor'
        );
        return;
      }

      // Determine language by file extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      let language = 'plaintext';

      if (extension === 'js') language = 'javascript';
      if (extension === 'ts') language = 'typescript';
      if (extension === 'jsx' || extension === 'tsx') language = 'typescript';
      if (extension === 'json') language = 'json';
      if (extension === 'html') language = 'html';
      if (extension === 'css') language = 'css';
      if (extension === 'st') language = IEC61131_LANGUAGE_ID; // IEC61131-3 Structured Text

      // Use a try-catch for all Monaco operations to catch any potential errors
      try {
        // Create a unique URI for the model
        const uri = monacoRef.current.Uri.parse(`file:///${file.id}`);

        // Check if a model with this URI already exists
        let model = monacoRef.current.editor.getModel(uri);
        let isNewModel = false;

        // Store current cursor position and selection if we're updating an existing model
        let savedSelection = null;
        let savedScrollPosition = null;

        if (
          model &&
          editorRef.current.getModel()?.uri.toString() === uri.toString()
        ) {
          // If the model is already active and being edited, don't overwrite it
          const currentModel = editorRef.current.getModel();
          if (currentModel && currentModel.uri.toString() === uri.toString()) {
            // The model is already active, don't replace its content
            // Just restore focus
            try {
              editorRef.current.focus();
            } catch (e) {
              console.error('Error focusing editor:', e);
            }
            return;
          }

          try {
            savedSelection = editorRef.current.getSelection();
            savedScrollPosition = editorRef.current.getScrollTop();
          } catch (e) {
            console.error('Error saving editor state:', e);
          }
        }

        // Create new model if needed with additional error handling
        if (!model) {
          try {
            model = monacoRef.current.editor.createModel(
              file.content || '',
              language,
              uri
            );
            isNewModel = true;
          } catch (e) {
            console.error('Error creating model:', e);
            return;
          }
        } else {
          // Ensure the model has the correct language
          try {
            if (model.getLanguageId() !== language) {
              monacoRef.current.editor.setModelLanguage(model, language);
            }
          } catch (e) {
            console.error('Error setting model language:', e);
          }
        }

        // If we have a model, set it as the active model
        if (model) {
          // Set the model to the editor with error handling
          try {
            editorRef.current.setModel(model);
          } catch (e) {
            console.error('Error setting editor model:', e);
            return;
          }

          // Only update content for existing models if necessary and with proper error handling
          if (
            !isNewModel &&
            !editorRef.current.hasTextFocus() &&
            file.content !== undefined
          ) {
            try {
              // Check if content actually needs updating
              const currentContent = model.getValue();

              if (currentContent !== file.content) {
                // Use setValue instead of the more complex pushEditOperations for better stability
                model.setValue(file.content);
              }
            } catch (e) {
              console.error('Error updating model content:', e);
            }
          }

          // Restore selection and scroll position with error handling
          try {
            if (savedSelection) {
              editorRef.current.setSelection(savedSelection);
            }

            if (savedScrollPosition !== null) {
              editorRef.current.setScrollTop(savedScrollPosition);
            }
          } catch (e) {
            console.error('Error restoring editor state:', e);
          }

          // Focus the editor with error handling
          setTimeout(() => {
            try {
              if (editorRef.current) {
                editorRef.current.focus();
              }
            } catch (e) {
              console.error('Error focusing editor:', e);
            }
          }, 10);
        }
      } catch (error) {
        console.error('Error in displayFileInEditor:', error);
      }
    },
    [editorReady]
  );

  // Handle editor mounting
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Set editor options for better usability
    editor.updateOptions({
      autoIndent: 'advanced',
      cursorBlinking: 'smooth',
      quickSuggestions: true,
      scrollBeyondLastLine: false,
      acceptSuggestionOnCommitCharacter: false,
      acceptSuggestionOnEnter: 'off',
      wrappingStrategy: 'advanced',
    });

    // Set the initial theme
    monaco.editor.setTheme(monacoTheme);

    // Register the IEC61131 language (Structured Text)
    let languageRegistered = false;
    try {
      console.log('Registering IEC61131 language...');
      registerIEC61131Language(monaco);
      languageRegistered = true;
      console.log('IEC61131 language registered successfully');
    } catch (error) {
      console.error('Error registering IEC61131 language:', error);
    }

    // Configure Monaco if needed
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2015,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      reactNamespace: 'React',
    });

    // Ensure editor is ready before marking as ready
    // This helps prevent the "Cannot read properties of undefined (reading 'domNode')" error
    setTimeout(() => {
      console.log('Setting editor as ready');
      setEditorReady(true);
    }, 100);

    // Initialize the IEC 61131-3 language services
    import('../server/iec61131/langium-monaco-setup')
      .then(({ setupLangiumMonaco }) => {
        console.log('Setting up Langium Monaco integration...');
        // Set up the Langium language services
        setupLangiumMonaco(monaco);

        // Set up keyboard shortcut for formatting IEC 61131 files
        editor.addAction({
          id: 'format-st-document',
          label: 'Format Document',
          keybindings: [
            monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
          ],
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.5,
          run: () => {
            // Execute the ST format command if it's an ST file
            const model = editor.getModel();
            if (model && model.getLanguageId() === 'iec-61131') {
              // Use a command that's registered by the setupLangiumMonaco function
              const formatAction = editor.getAction('st.formatDocument');
              if (formatAction) {
                formatAction.run();
              }
            }
          },
        });
      })
      .catch((error) => {
        console.error('Error setting up Langium Monaco integration:', error);
      });

    // Add Format Document command for structured text files
    const formatCommandId = 'format-st-document';
    editor.addAction({
      id: formatCommandId,
      label: 'Format Document',
      keybindings: [
        monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      ],
      contextMenuGroupId: 'formatting',
      precondition: undefined,
      keybindingContext: undefined,
      run: (ed) => {
        // Create a custom formatter function
        const formatSTDocument = () => {
          const model = ed.getModel();
          if (!model || model.getLanguageId() !== 'iec-61131') return;

          const lineCount = model.getLineCount();
          const edits = [];

          // Track indentation level
          let indentLevel = 0;

          // Define statements that increase indentation
          const indentIncreasePatterns = [
            /\b(PROGRAM|FUNCTION|FUNCTION_BLOCK|IF|ELSE|ELSIF|CASE|FOR|WHILE|REPEAT|VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT)\b/i,
          ];

          // Define statements that decrease indentation
          const indentDecreasePatterns = [
            /\b(END_PROGRAM|END_FUNCTION|END_FUNCTION_BLOCK|END_IF|END_CASE|END_FOR|END_WHILE|UNTIL|END_VAR)\b/i,
            /\b(ELSE|ELSIF)\b/i,
          ];

          // Helper function to get the indentation of a line
          function getIndentation(line: string): string {
            const match = line.match(/^[ \t]*/);
            return match ? match[0] : '';
          }

          // Helper function to check if a line needs a semicolon
          function needsSemicolon(line: string): boolean {
            // Don't add semicolons to these statements
            if (!line || line.trim() === '' || line.endsWith(';')) {
              return false;
            }

            // Skip comments (both line comments and block comments)
            if (
              line.trim().startsWith('//') ||
              line.trim().startsWith('(*') ||
              line.trim().endsWith('*)')
            ) {
              return false;
            }

            // Skip adding semicolons to block statements and comments
            const skipPatterns = [
              /\b(PROGRAM|END_PROGRAM|FUNCTION|END_FUNCTION|FUNCTION_BLOCK|END_FUNCTION_BLOCK)\b/i,
              /\b(IF|THEN|ELSE|ELSIF|END_IF|CASE|OF|END_CASE)\b/i,
              /\b(FOR|TO|BY|DO|END_FOR|WHILE|DO|END_WHILE|REPEAT|UNTIL|END_REPEAT)\b/i,
              /\b(VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|END_VAR|TYPE|END_TYPE|STRUCT|END_STRUCT)\b/i,
              /\b(EXIT)\b/i, // EXIT statement doesn't need a semicolon per the standard
              /^\/\/.*$/, // Line comments
              /\(\*.*\*\)/, // Block comments
            ];

            for (const pattern of skipPatterns) {
              if (pattern.test(line)) {
                return false;
              }
            }

            // Add semicolons to assignment statements and other expressions
            const needsSemicolonPatterns = [
              /:=/, // Assignment
              /\b[A-Za-z_]\w*\(.*\)/, // Function call (must have opening and closing parentheses)
              /\+|-|\*|\/|<|>|<=|>=|<>|=|AND|OR|XOR|NOT|MOD/i, // Expressions with operators
              /\bRETURN\b/i, // RETURN statement needs a semicolon
            ];

            for (const pattern of needsSemicolonPatterns) {
              if (pattern.test(line)) {
                return true;
              }
            }

            return false;
          }

          // Process each line
          for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
            const lineText = model.getLineContent(lineNumber);
            const trimmedLine = lineText.trim();

            // Skip empty lines and comments
            if (
              !trimmedLine ||
              trimmedLine.startsWith('//') ||
              trimmedLine.startsWith('(*')
            ) {
              continue;
            }

            // Check if this line should decrease the indent level before indenting
            let decreasedThisLine = false;
            for (const pattern of indentDecreasePatterns) {
              if (pattern.test(trimmedLine)) {
                indentLevel = Math.max(0, indentLevel - 1);
                decreasedThisLine = true;
                break;
              }
            }

            // Calculate the proper indentation
            const properIndent = '  '.repeat(indentLevel);
            const currentIndent = getIndentation(lineText);

            // Add edit for indentation if it's incorrect
            if (currentIndent !== properIndent) {
              edits.push({
                range: {
                  startLineNumber: lineNumber,
                  startColumn: 1,
                  endLineNumber: lineNumber,
                  endColumn: currentIndent.length + 1,
                },
                text: properIndent,
              });
            }

            // Check if we need to add a semicolon
            if (needsSemicolon(trimmedLine)) {
              edits.push({
                range: {
                  startLineNumber: lineNumber,
                  startColumn: model.getLineMaxColumn(lineNumber),
                  endLineNumber: lineNumber,
                  endColumn: model.getLineMaxColumn(lineNumber),
                },
                text: ';',
              });
            }

            // Check if this line should increase the indent level for the next line
            if (!decreasedThisLine) {
              for (const pattern of indentIncreasePatterns) {
                if (pattern.test(trimmedLine)) {
                  indentLevel++;
                  break;
                }
              }
            }
          }

          // Apply all the edits at once
          if (edits.length > 0) {
            ed.executeEdits('format-document', edits);
          }
        };

        // Execute the formatting
        formatSTDocument();
      },
    });

    // Add a UI button for formatting when the editor has ST files
    const formatButton = document.createElement('div');
    formatButton.className = 'monaco-format-button';
    formatButton.style.position = 'absolute';
    formatButton.style.bottom = '10px';
    formatButton.style.right = '10px';
    formatButton.style.zIndex = '100';
    formatButton.style.backgroundColor = '#007acc';
    formatButton.style.color = 'white';
    formatButton.style.padding = '5px 10px';
    formatButton.style.borderRadius = '3px';
    formatButton.style.cursor = 'pointer';
    formatButton.style.fontSize = '12px';
    formatButton.style.display = 'none';
    formatButton.textContent = 'Format Document (Alt+Shift+F)';
    formatButton.title =
      'Format IEC 61131-3 code with proper indentation and semicolons';
    formatButton.onclick = () => {
      const action = editor.getAction(formatCommandId);
      if (action) {
        action.run();
      }
    };

    // Add the button to the editor container
    setTimeout(() => {
      const editorContainer = editor.getDomNode();
      if (editorContainer) {
        editorContainer.parentElement?.appendChild(formatButton);
      }
    }, 200);

    // Show/hide button based on language
    editor.onDidChangeModel(() => {
      setTimeout(() => {
        const model = editor.getModel();
        if (model && model.getLanguageId() === 'iec-61131') {
          formatButton.style.display = 'block';
        } else {
          formatButton.style.display = 'none';
        }
      }, 100);
    });
  };

  // Add a helper function to refresh syntax highlighting
  const refreshSyntaxHighlighting = useCallback(
    (model: editor.ITextModel | null, language: string) => {
      if (!model || !monacoRef.current) return;

      try {
        // Safety check: make sure the editor DOM node exists
        if (!editorRef.current || !editorRef.current.getDomNode()) {
          console.log(
            'Cannot refresh syntax highlighting - editor DOM node not ready'
          );
          return;
        }

        // First ensure the model has the correct language
        if (model.getLanguageId() !== language) {
          console.log(`Setting language for model to ${language}`);
          monacoRef.current.editor.setModelLanguage(model, language);
        }

        // For structured text files, we may need an extra push
        if (language === IEC61131_LANGUAGE_ID) {
          try {
            // Force tokenization of the entire file
            const lineCount = model.getLineCount();

            // Manual tokenization - force Monaco to recompute tokens
            // Note: getLineTokens doesn't exist on ITextModel directly, but we can use related APIs
            for (let i = 1; i <= lineCount; i++) {
              // Request tokens indirectly by getting line decorations
              model.getLineDecorations(i);
            }
          } catch (e) {
            console.error('Error during syntax highlighting tokenization:', e);
          }
        }
      } catch (error) {
        console.error('Error in refreshSyntaxHighlighting:', error);
      }
    },
    [monacoRef, editorRef]
  );

  // Update editor content when activeFileId changes
  useEffect(() => {
    if (activeFileId && editorReady) {
      // Find the file by ID
      const activeFile = openFiles.find((file) => file.id === activeFileId);
      if (activeFile) {
        displayFileInEditor(activeFile);

        // After a short delay, refresh syntax highlighting
        setTimeout(() => {
          if (editorRef.current && monacoRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              // Determine language for this file
              const extension = activeFile.name.split('.').pop()?.toLowerCase();
              let language = 'plaintext';

              if (extension === 'js') language = 'javascript';
              if (extension === 'ts') language = 'typescript';
              if (extension === 'jsx' || extension === 'tsx')
                language = 'typescript';
              if (extension === 'json') language = 'json';
              if (extension === 'html') language = 'html';
              if (extension === 'css') language = 'css';
              if (extension === 'st') language = IEC61131_LANGUAGE_ID;

              // Refresh syntax highlighting
              refreshSyntaxHighlighting(model, language);
            }
          }
        }, 200);
      }
    }
  }, [
    activeFileId,
    openFiles,
    displayFileInEditor,
    editorReady,
    refreshSyntaxHighlighting,
  ]);

  // Get WebSocket context at component level
  const { controllers, connect, disconnect, addController } = useWebSocket();

  // Add a special safety effect to protect against DOM node errors
  useEffect(() => {
    // This effect runs when editorReady changes to true
    // and will safely initialize the editor DOM elements
    if (editorReady && editorRef.current) {
      console.log('Running DOM safety effect for Monaco Editor');

      // Function to verify DOM nodes are properly set up
      const verifyEditorDom = () => {
        try {
          const domNode = editorRef.current?.getDomNode();
          if (!domNode) {
            console.log('Editor DOM node still not available, will retry');
            // Retry after a delay
            setTimeout(verifyEditorDom, 100);
            return false;
          }
          return true;
        } catch (e) {
          console.error('Error accessing editor DOM node:', e);
          return false;
        }
      };

      // Initial verification
      if (!verifyEditorDom()) {
        // If verification failed, we'll rely on the retry logic in verifyEditorDom
        return;
      }

      // If we have an active file and the DOM is verified, try to display it
      if (activeFileId) {
        const activeFile = openFiles.find((file) => file.id === activeFileId);
        if (activeFile) {
          try {
            console.log(`Safely displaying active file: ${activeFile.name}`);
            // Use a short delay to ensure all Monaco Editor internals are ready
            setTimeout(() => {
              try {
                displayFileInEditor(activeFile);
              } catch (e) {
                console.error('Error displaying file in safety effect:', e);
              }
            }, 100);
          } catch (e) {
            console.error('Error in safety effect file display:', e);
          }
        }
      }
    }
  }, [editorReady, activeFileId, openFiles, displayFileInEditor]);

  // Use our custom language client hook - but only after editor is ready
  useEffect(() => {
    if (editorReady && monacoRef.current && editorRef.current) {
      // Start language client after editor is fully ready
      const delay = setTimeout(() => {
        // This is where we would normally call the hook, but we can't call hooks conditionally
        // Instead, we'll set a flag that will be used by the language client hook
        const worker = new Worker(
          new URL('../workers/langium-worker.ts', import.meta.url),
          { type: 'module' }
        );

        setupLanguageClient(monacoRef.current!, editorRef.current!, worker);

        return () => {
          worker.terminate();
        };
      }, 500);

      return () => clearTimeout(delay);
    }
  }, [editorReady]);

  // Language client setup (not a hook)
  function setupLanguageClient(
    monaco: Monaco,
    editor: editor.IStandaloneCodeEditor,
    worker: Worker
  ) {
    let currentModel: editor.ITextModel | null = null;
    let modelChangeSubscription: { dispose: () => void } | null = null;
    let isProcessingDiagnostics = false;
    let contentChangeDebounce: ReturnType<typeof setTimeout> | null = null;
    let lastContent = '';

    try {
      // Handle worker messages
      worker.onmessage = (event) => {
        // Handle diagnostics
        if (
          event.data.type === 'diagnostics' &&
          event.data.uri &&
          event.data.diagnostics
        ) {
          try {
            // Ensure we don't trigger another content change while updating markers
            isProcessingDiagnostics = true;

            const model = monaco.editor.getModel(
              monaco.Uri.parse(event.data.uri)
            );

            if (model) {
              monaco.editor.setModelMarkers(
                model,
                'langium',
                event.data.diagnostics.map((d: any) => ({
                  startLineNumber: d.range.start.line + 1,
                  startColumn: d.range.start.character + 1,
                  endLineNumber: d.range.end.line + 1,
                  endColumn: d.range.end.character + 1,
                  message: d.message,
                  severity:
                    d.severity === 1
                      ? monaco.MarkerSeverity.Error
                      : d.severity === 2
                      ? monaco.MarkerSeverity.Warning
                      : monaco.MarkerSeverity.Info,
                }))
              );
            }

            // Re-enable content change processing
            setTimeout(() => {
              isProcessingDiagnostics = false;
            }, 0);
          } catch (error) {}
        }
      };

      // Set up content change handler
      const setupModelChangeListener = () => {
        // Clean up previous subscription if it exists
        if (modelChangeSubscription) {
          modelChangeSubscription.dispose();
          modelChangeSubscription = null;
        }

        currentModel = editor.getModel();
        if (currentModel) {
          modelChangeSubscription = currentModel.onDidChangeContent(
            (_event) => {
              try {
                // Skip if we're currently processing diagnostics to avoid infinite loops
                if (isProcessingDiagnostics) {
                  return;
                }

                // Skip if this is a programmatic content update
                // We added a flag to the model in the displayFileInEditor function
                if ((currentModel as any)._isSettingContent) {
                  return;
                }

                // Get current content
                const content = currentModel?.getValue() || '';

                // Skip if content hasn't changed
                if (content === lastContent) {
                  return;
                }

                lastContent = content;

                // Debounce content changes to reduce worker messages and only send after typing pauses
                if (contentChangeDebounce) {
                  clearTimeout(contentChangeDebounce);
                }

                contentChangeDebounce = setTimeout(() => {
                  worker.postMessage({
                    type: 'documentChange',
                    uri: currentModel?.uri.toString(),
                    content,
                  });
                  contentChangeDebounce = null;
                }, 800); // Longer delay to ensure user has finished typing
              } catch (error) {}
            }
          );
        }
      };

      // Initial setup
      setupModelChangeListener();

      // Listen for model changes in the editor
      const modelChangeDisposable = editor.onDidChangeModel(() => {
        // Reset state when model changes
        lastContent = '';
        if (contentChangeDebounce) {
          clearTimeout(contentChangeDebounce);
          contentChangeDebounce = null;
        }
        isProcessingDiagnostics = false;

        setupModelChangeListener();

        // Send initial content to worker with some delay to ensure editor is ready
        const model = editor.getModel();
        if (model) {
          setTimeout(() => {
            const content = model.getValue();
            lastContent = content;
            worker.postMessage({
              type: 'documentChange',
              uri: model.uri.toString(),
              content,
            });
          }, 300);
        }
      });

      // Return cleanup function
      return () => {
        modelChangeDisposable.dispose();
        if (modelChangeSubscription) {
          modelChangeSubscription.dispose();
        }
        if (contentChangeDebounce) {
          clearTimeout(contentChangeDebounce);
        }
      };
    } catch (error) {
      return () => {};
    }
  }

  // Get active file
  const activeFile = openFiles.find((file) => file.id === activeFileId) || null;

  // Navigation history handlers
  const addToHistory = useCallback(
    (fileId: string) => {
      if (navPosition >= 0 && navHistory[navPosition] === fileId) {
        return; // Don't add if it's the same as current
      }

      // Remove any forward history
      const newHistory =
        navPosition >= 0 ? navHistory.slice(0, navPosition + 1) : [];

      setNavHistory([...newHistory, fileId]);
      setNavPosition(newHistory.length);
    },
    [navHistory, navPosition]
  );

  const handleNavigateBack = () => {
    if (navPosition > 0) {
      const newPosition = navPosition - 1;
      setNavPosition(newPosition);
      const fileId = navHistory[newPosition];
      // Find the file by ID and select it
      const file = findFileById(files, fileId);
      if (file) {
        handleSelectFile(file, false); // false to not add to history again
      }
    }
  };

  const handleNavigateForward = () => {
    if (navPosition < navHistory.length - 1) {
      const newPosition = navPosition + 1;
      setNavPosition(newPosition);
      const fileId = navHistory[newPosition];
      // Find the file by ID and select it
      const file = findFileById(files, fileId);
      if (file) {
        handleSelectFile(file, false); // false to not add to history again
      }
    }
  };

  // Helper to find a file by ID
  const findFileById = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const found = findFileById(node.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  // Modified handleSelectFile to detect project (top-level folder) this file belongs to
  const handleSelectFile = useCallback(
    (node: FileNode, addHistory = true) => {
      if (!node.isFolder) {
        // Skip project name detection if we have a project name from props
        if (!hasProjectNameProp.current) {
          // Find which project (top-level folder) this file belongs to
          const findProjectForFile = (
            nodes: FileNode[],
            targetId: string
          ): string => {
            // Helper function to search in the file tree
            const findProject = (
              currentNodes: FileNode[],
              id: string,
              currentParents: FileNode[] = []
            ): { found: boolean; projectName: string } => {
              for (const n of currentNodes) {
                // If this is the file we're looking for
                if (n.id === id) {
                  // Check if this file has any parent (which would be the project)
                  if (currentParents.length > 0) {
                    // The first parent in the chain is the top-level folder (project)
                    return { found: true, projectName: currentParents[0].name };
                  }
                  // File at root level - use a default project name instead of null
                  return { found: true, projectName: 'Hyperdrive Project' };
                }

                // If not found and we have a folder with children, search recursively
                if (n.isFolder && n.children) {
                  const result = findProject(n.children, id, [
                    ...currentParents,
                    n,
                  ]);
                  if (result.found) {
                    return result;
                  }
                }
              }
              return { found: false, projectName: 'Hyperdrive Project' };
            };

            const result = findProject(nodes, targetId);
            return result.projectName;
          };

          // Find the project name for this file
          const projectName = findProjectForFile(files, node.id);
          setCurrentProjectName(projectName);
        }

        // Check if file is already open
        const isFileOpen = openFiles.some((file) => file.id === node.id);

        if (!isFileOpen) {
          // Add to open files
          setOpenFiles((prev) => [...prev, node]);
        }

        // Set active file
        setActiveFileId(node.id);

        // Add to navigation history if needed
        if (addHistory) {
          addToHistory(node.id);
        }

        // Wait until the editor is fully ready before displaying the file
        if (editorReady && editorRef.current && monacoRef.current) {
          // Display the file with a small delay to ensure all components are ready
          setTimeout(() => {
            displayFileInEditor(node);
          }, 50);
        }
      }
    },
    [
      openFiles,
      displayFileInEditor,
      editorReady,
      addToHistory,
      files,
      projectName,
    ]
  );

  // Mark file as having unsaved changes when content changes
  const handleContentChange = useCallback(() => {
    if (activeFileId && editorRef.current) {
      const currentContent = editorRef.current.getValue();
      const activeFile = openFiles.find((file) => file.id === activeFileId);

      if (activeFile && currentContent !== activeFile.content) {
        setHasUnsavedChanges(true);
        setUnsavedFileIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(activeFileId);
          return newSet;
        });
      }
    }
  }, [activeFileId, openFiles]);

  // Set up editor change event listener
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const disposable = editorRef.current.onDidChangeModelContent(() => {
        handleContentChange();
      });
      return () => disposable.dispose();
    }
  }, [editorRef.current, monacoRef.current, handleContentChange]);

  // Reset unsaved changes when saving files
  const handleSaveFile = useCallback(() => {
    if (activeFileId && editorRef.current) {
      const currentContent = editorRef.current.getValue();
      const activeFile = openFiles.find((file) => file.id === activeFileId);

      // Check if this is a controller configuration file
      const isControllerFile = activeFile?.nodeType === 'controller';
      let updatedMetadata = activeFile?.metadata || {};

      // If this is a controller file, parse the JSON to extract the new IP
      if (isControllerFile && activeFile) {
        try {
          const controllerConfig = JSON.parse(currentContent);
          const newIp = controllerConfig.ip;
          const oldIp = activeFile.metadata?.ip;

          // Only update if the IP has changed
          if (newIp && newIp !== oldIp) {
            updatedMetadata = {
              ...updatedMetadata,
              ip: newIp,
              version: controllerConfig.version || updatedMetadata.version,
              description:
                controllerConfig.description || updatedMetadata.description,
            };

            console.log(`Updating controller IP from ${oldIp} to ${newIp}`);

            // Check if this controller is connected
            const isConnected = controllers.find(
              (c) => c.id === activeFile.id
            )?.isConnected;

            // If connected, disconnect and reconnect with the new IP
            if (isConnected) {
              toast.info(
                `Reconnecting to ${activeFile.name} with new IP: ${newIp}`
              );

              // Update controller in WebSocket context
              addController(activeFile.id, activeFile.name, newIp);

              // Disconnect first
              disconnect(activeFile.id);

              // Reconnect with new IP after a short delay
              setTimeout(() => {
                connect(activeFile.id);
              }, 500);
            } else {
              // Just update the controller in WebSocket context
              addController(activeFile.id, activeFile.name, newIp);
            }
          }
        } catch (error) {
          console.error('Error parsing controller configuration:', error);
          toast.error(
            'Failed to update controller configuration. Invalid JSON format.'
          );
        }
      }

      // Update the file content in our state
      setFiles((prevFiles) => {
        const updateFileContent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === activeFileId) {
              return {
                ...node,
                content: currentContent,
                // If this is a controller file, also update the metadata
                ...(isControllerFile && { metadata: updatedMetadata }),
              };
            }
            if (node.children) {
              return {
                ...node,
                children: updateFileContent(node.children),
              };
            }
            return node;
          });
        };

        return updateFileContent(prevFiles);
      });

      // Also update in open files
      setOpenFiles((prevOpenFiles) =>
        prevOpenFiles.map((file) =>
          file.id === activeFileId
            ? {
                ...file,
                content: currentContent,
                // If this is a controller file, also update the metadata
                ...(isControllerFile && { metadata: updatedMetadata }),
              }
            : file
        )
      );

      // Reset unsaved changes flag for this file
      setUnsavedFileIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(activeFileId);
        return newSet;
      });

      // Only reset global unsaved changes if no files are unsaved
      if (unsavedFileIds.size <= 1) {
        setHasUnsavedChanges(false);
      }

      // Display a toast to confirm save
      toast.success(`File saved: ${activeFile?.name}`);
    }
  }, [
    activeFileId,
    editorRef,
    unsavedFileIds,
    openFiles,
    controllers,
    disconnect,
    connect,
    addController,
  ]);

  // Handle deploying to a specific controller
  const handleDeployToController = (node: FileNode) => {
    if (node.nodeType === 'controller' && node.metadata?.ip) {
      setIsDeploying(true);
      // In a real implementation, this would deploy the code to the specific controller
      toast.info(
        `Deploying to controller ${node.name} at ${node.metadata.ip}`,
        {
          description:
            'This is a placeholder for the actual deployment functionality',
        }
      );

      // Simulate API call
      setTimeout(() => {
        toast.success('Deployment successful', {
          description: `Code deployed to ${node.name}`,
        });
        setIsDeploying(false);
      }, 2000);
    }
  };

  // Toggle connection to runtime
  const handleToggleConnection = useCallback(() => {
    // In a real implementation, this would connect to or disconnect from the runtime
    setConnected((prevConnected) => !prevConnected);
  }, [connected]);

  // Handle tab click
  const handleTabClick = (fileId: string) => {
    const file = openFiles.find((f) => f.id === fileId);
    if (file) {
      // Set as active file
      setActiveFileId(file.id);
    }
  };

  // Handle tab close
  const handleTabClose = (fileId: string) => {
    // Remove from open files
    setOpenFiles((prev) => prev.filter((file) => file.id !== fileId));

    // If closing the active file, activate another file if available
    if (fileId === activeFileId) {
      const remainingFiles = openFiles.filter((file) => file.id !== fileId);
      if (remainingFiles.length > 0) {
        setActiveFileId(remainingFiles[remainingFiles.length - 1].id);
        handleSelectFile(remainingFiles[remainingFiles.length - 1]);
      } else {
        setActiveFileId(null);
      }
    }
  };

  // Update file content when editor changes
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    // Use a debounce mechanism to prevent rapid updates
    let debounceTimeout: NodeJS.Timeout | null = null;
    let isUpdating = false;

    const updateContent = () => {
      // Skip if we're already in the middle of an update
      if (isUpdating) return;

      isUpdating = true;

      const newContent = editorRef.current?.getValue() || '';

      // Special check for content changes, including whitespace
      const contentChanged = activeFile.content !== newContent;

      // Only update if content has actually changed
      if (contentChanged) {
        const updateFileContent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === activeFile.id) {
              return {
                ...node,
                content: newContent,
              };
            }

            if (node.children) {
              return {
                ...node,
                children: updateFileContent(node.children),
              };
            }

            return node;
          });
        };

        // Update in the files tree
        setFiles(updateFileContent(files));

        // Update in open files
        setOpenFiles((prev) =>
          prev.map((file) =>
            file.id === activeFile.id ? { ...file, content: newContent } : file
          )
        );
      }

      isUpdating = false;
    };

    const handleContentChange = () => {
      // Clear any existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Set a new timeout to update after a delay
      // Use a shorter delay for better responsiveness
      debounceTimeout = setTimeout(() => {
        updateContent();
      }, 150); // Reduced from 300ms to 150ms for better responsiveness
    };

    const disposable =
      editorRef.current.onDidChangeModelContent(handleContentChange);

    return () => {
      // Clean up
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      disposable.dispose();
    };
  }, [activeFile, files]);

  // Update files if initialFiles changes
  useEffect(() => {
    if (initialFiles) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  // Function to generate a unique ID
  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle adding a new file or folder
  const handleAddFile = (parentNode: FileNode | null, isFolder: boolean) => {
    setFileDialog({
      isOpen: true,
      isFolder,
      parentNode,
    });
  };

  // Handle adding a new controller to Devices section
  const handleAddController = () => {
    // Open a dialog to get controller details
    const controllerName = prompt('Enter controller name:');
    if (!controllerName) return;

    const controllerIp = prompt(
      'Enter controller IP address:',
      '192.168.1.100'
    );
    if (!controllerIp) return;

    // Find the Devices section
    const devicesSection = files.find((node) => node.id === 'devices-section');
    if (!devicesSection) return;

    // Create a new controller node
    const newController: FileNode = {
      id: generateId(),
      name: controllerName,
      isFolder: false,
      nodeType: 'controller',
      content: JSON.stringify(
        {
          name: controllerName,
          ip: controllerIp,
          version: '1.0.0',
          status: 'online',
          description: 'Main PLC controller for production line',
        },
        null,
        2
      ),
      metadata: {
        ip: controllerIp,
        version: '1.0.0',
        description: 'Main PLC controller for production line',
      },
    };

    // Update the files state to add the new controller to the Devices section
    setFiles((prevFiles) => {
      return prevFiles.map((node) => {
        if (node.id === 'devices-section') {
          return {
            ...node,
            children: [...(node.children || []), newController],
          };
        }
        return node;
      });
    });

    // Select the new controller to show its content
    handleSelectFile(newController);
  };

  // Create new file or folder
  const createNewFileOrFolder = (name: string) => {
    const { parentNode, isFolder } = fileDialog;

    // If parent is a heading node, check if it's the Devices section
    if (
      parentNode?.nodeType === 'heading' &&
      parentNode.id === 'devices-section'
    ) {
      // For the Devices section, we might want to create a controller instead of a regular file
      // Here we could prompt the user to choose, but for simplicity,
      // let's check if the name has "controller" in it to decide
      if (name.toLowerCase().includes('controller')) {
        // Close dialog first
        setFileDialog({
          isOpen: false,
          isFolder: false,
          parentNode: null,
        });

        // Create a controller with a default IP
        const controllerIp = prompt(
          'Enter controller IP address:',
          '192.168.1.100'
        );
        if (!controllerIp) return;

        // Create a new controller node
        const newController: FileNode = {
          id: generateId(),
          name,
          isFolder: false,
          nodeType: 'controller',
          content: JSON.stringify(
            {
              name,
              ip: controllerIp,
              version: '1.0.0',
              status: 'online',
              description: 'Main PLC controller for production line',
            },
            null,
            2
          ),
          metadata: {
            ip: controllerIp,
            version: '1.0.0',
            description: 'Main PLC controller for production line',
          },
        };

        // Update the files state to add the new controller to the Devices section
        setFiles((prevFiles) => {
          return prevFiles.map((node) => {
            if (node.id === 'devices-section') {
              return {
                ...node,
                children: [...(node.children || []), newController],
              };
            }
            return node;
          });
        });

        // Select the new controller to show its content
        handleSelectFile(newController);
        return;
      }
    }

    // Create new node
    const newNode: FileNode = {
      id: generateId(),
      name,
      isFolder,
      content: isFolder ? undefined : '',
      children: isFolder ? [] : undefined,
      nodeType: isFolder ? 'folder' : 'file',
    };

    // If parent node is provided, add as child
    if (parentNode) {
      setFiles((prevFiles) => {
        // Deep clone the files array
        const updatedFiles = JSON.parse(JSON.stringify(prevFiles));

        // Find and update the parent node in the cloned structure
        const findAndAddToParent = (nodes: FileNode[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            if (node.id === parentNode.id) {
              // Found the parent node, add the new child
              // Ensure parent node has a children array if it's a folder
              if (node.isFolder) {
                // Initialize children array if it doesn't exist
                node.children = node.children || [];
                node.children.push(newNode);
                return true;
              }
              return false; // Not a folder, can't add children
            }

            // Recursively search in children if they exist
            if (
              node.isFolder &&
              node.children &&
              findAndAddToParent(node.children)
            ) {
              return true;
            }
          }
          return false;
        };

        findAndAddToParent(updatedFiles);
        return updatedFiles;
      });
    } else {
      // Add at root level
      setFiles((prevFiles) => [...prevFiles, newNode]);
    }

    // If it's a file, select it
    if (!isFolder) {
      // Adding to open files and selecting
      setOpenFiles((prev) => [...prev, newNode]);
      setActiveFileId(newNode.id);
    }
  };

  // Handle file deletion
  const handleDeleteFile = (node: FileNode) => {
    setDeleteDialog({
      isOpen: true,
      node,
    });
  };

  // Confirm file deletion
  const confirmDelete = () => {
    const nodeToDelete = deleteDialog.node;
    if (!nodeToDelete) return;

    // Remove from files
    setFiles((prevFiles) => {
      // Deep clone
      const updatedFiles = JSON.parse(JSON.stringify(prevFiles));

      // Helper function to remove node
      const removeNode = (nodes: FileNode[]): FileNode[] => {
        // Filter out the node to delete at current level
        const filtered = nodes.filter((n) => n.id !== nodeToDelete.id);

        // Recursively process children
        return filtered.map((node) => {
          if (node.isFolder && node.children) {
            return {
              ...node,
              children: removeNode(node.children),
            };
          }
          return node;
        });
      };

      return removeNode(updatedFiles);
    });

    // If deleted file is open, close it
    if (openFiles.some((f) => f.id === nodeToDelete.id)) {
      setOpenFiles((prev) => prev.filter((f) => f.id !== nodeToDelete.id));

      // If it's the active file, set a new active file or null
      if (activeFileId === nodeToDelete.id) {
        const remainingFiles = openFiles.filter(
          (f) => f.id !== nodeToDelete.id
        );
        if (remainingFiles.length > 0) {
          setActiveFileId(remainingFiles[0].id);
        } else {
          setActiveFileId(null);
        }
      }
    }

    // Close dialog
    setDeleteDialog({ isOpen: false, node: null });
  };

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }

      // Alt+Left for back navigation
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateBack();
      }

      // Alt+Right for forward navigation
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateForward();
      }

      // Ctrl+Shift+D or Cmd+Shift+D to deploy
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        if (activeFile) {
          handleDeployToController(activeFile);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleSaveFile,
    handleNavigateBack,
    handleNavigateForward,
    handleDeployToController,
    activeFile,
  ]);

  // Helper function to format project name
  const formatProjectName = (name: string | null): string => {
    if (!name) return 'Hyperdrive Project';

    // Convert from kebab-case or snake_case to Title Case
    return name
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get the AST for the current file
  const getAst = useCallback(() => {
    if (!editorRef.current || !monacoRef.current || !activeFile) {
      return null;
    }

    // Try to get the langium services
    try {
      const model = editorRef.current.getModel();
      if (!model || model.getLanguageId() !== IEC61131_LANGUAGE_ID) {
        console.error('Not an IEC-61131 file');
        return null;
      }

      // Get the document content
      const content = model.getValue();

      // For simplicity, create a basic AST representing the code structure
      // This is a placeholder - in a real implementation, you would use
      // Langium's parsing capabilities to generate a proper AST
      const ast: any = {
        type: 'Program',
        name: activeFile.name.replace(/\.st$/, ''),
        statements: [],
        declarations: [] as Array<{
          type: string;
          name: string;
          dataType: string;
          initialValue?: string;
        }>,
        content: content,
      };

      // Extract variable declarations using regular expressions
      // This is a very simplified approach - in a real implementation, use proper parsing
      const varRegex =
        /VAR(?:_INPUT|_OUTPUT|_EXTERNAL|_IN_OUT)?\s+(.*?)END_VAR/gs;
      let varMatch;
      while ((varMatch = varRegex.exec(content)) !== null) {
        const varBlockContent = varMatch[1];
        const varLineRegex = /(\w+)\s*:\s*(\w+)\s*(?::\=\s*([^;]+))?;/g;
        let varLineMatch;
        while ((varLineMatch = varLineRegex.exec(varBlockContent)) !== null) {
          const varName = varLineMatch[1];
          const varType = varLineMatch[2];
          const varInitValue = varLineMatch[3];

          ast.declarations.push({
            type: 'VariableDeclaration',
            name: varName,
            dataType: varType,
            initialValue: varInitValue,
          });
        }
      }

      return JSON.stringify(ast);
    } catch (error) {
      console.error('Error getting AST:', error);
      return null;
    }
  }, [activeFile]);

  // New state for deploying
  const [isDeploying, setIsDeploying] = useState(false);

  const handleOpenTrends = (node: FileNode) => {
    // For trends, we'll create a special node with a unique ID
    const trendsNode: FileNode = {
      ...node,
      id: `trends-${node.id}`,
      name: `Trends: ${node.name}`,
      nodeType: 'trends', // Using a valid nodeType
    };

    // Check if we already have this trends tab open
    if (openFiles.some((f) => f.id === trendsNode.id)) {
      // If it's already open, just activate it
      setActiveFileId(trendsNode.id);
    } else {
      // Add it to open files
      setOpenFiles([...openFiles, trendsNode]);
      setActiveFileId(trendsNode.id);
    }
  };

  // Register controllers with WebSocketContext when component mounts
  useEffect(() => {
    if (files) {
      // Keep track of registered controllers to prevent redundant registrations
      const registeredControllers = new Set();

      // Find all controller nodes in the files array
      const findControllers = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.nodeType === 'controller' && node.id && node.metadata?.ip) {
            // Only register if we haven't registered this controller already
            const controllerKey = `${node.id}-${node.metadata.ip}`;
            if (!registeredControllers.has(controllerKey)) {
              registeredControllers.add(controllerKey);
              addController(node.id, node.name, node.metadata.ip);
            }
          }

          if (node.children) {
            findControllers(node.children);
          }
        });
      };

      findControllers(files);
    }
  }, [files]); // Remove addController from dependencies to prevent infinite loop

  // Add a new handler for viewing controller status
  const handleViewControllerStatus = (node: FileNode) => {
    console.log('Viewing status for controller:', node.name);

    // Create a special tab for viewing controller status
    const statusTabId = `status-${node.id}`;

    // Check if the tab is already open
    const existingTab = openFiles.find((file) => file.id === statusTabId);
    if (existingTab) {
      // If already open, just set it as active
      setActiveFileId(statusTabId);
      return;
    }

    // Create a new status tab for this controller
    const statusTab: FileNode = {
      id: statusTabId,
      name: node.name,
      path: node.path,
      isFolder: false,
      children: [],
      nodeType: 'status', // Mark this as a status node
      metadata: node.metadata, // Preserve the controller metadata
    };

    // Add to open files
    setOpenFiles((prev) => [...prev, statusTab]);

    // Set as active
    setActiveFileId(statusTabId);
  };

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        projectName={currentProjectName}
        onDeploy={() => {
          // Get the AST and deploy the code
          if (activeFile) {
            const ast = getAst();
            if (ast) {
              setIsDeploying(true);
              fetch('http://localhost:3000/api/deploy', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ast: ast,
                  sourceCode: activeFile.content || '',
                  filePath: activeFile.id,
                }),
              })
                .then((response) => {
                  if (!response.ok) {
                    throw new Error('Deployment failed');
                  }
                  return response.json();
                })
                .then(() => {
                  toast.success('Deployment successful', {
                    description: `Code deployed to ${activeFile.id}`,
                  });
                })
                .catch((error) => {
                  console.error('Deployment error:', error);
                  toast.error('Deployment failed', {
                    description: error.message || 'Unknown error',
                  });
                })
                .finally(() => {
                  setIsDeploying(false);
                });
            }
          }
        }}
        hasUnsavedChanges={hasUnsavedChanges}
        isDeploying={isDeploying}
      />
      <div className="h-full flex">
        <Resizable
          defaultSize={{ width: '20%', height: '100%' }}
          minWidth={200}
          maxWidth="50%"
          enable={{ right: true }}
          className="border-r dark:border-gray-700"
        >
          <ProjectSidebar
            files={files}
            onSelectFile={handleSelectFile}
            selectedFileId={activeFileId}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onDeploy={handleDeployToController}
            onAddController={handleAddController}
            onOpenTrends={handleOpenTrends}
            onViewControllerStatus={handleViewControllerStatus}
          />
        </Resizable>

        <div className="flex-1 flex flex-col">
          <div className="h-10 flex items-center border-b overflow-x-auto">
            <div className="flex items-center px-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNavigateBack}
                title="Navigate Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNavigateForward}
                title="Navigate Forward"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {openFiles.map((file) => (
              <LocalEditorTab
                key={file.id}
                file={file}
                isActive={file.id === activeFileId}
                onClick={() => handleTabClick(file.id)}
                onClose={() => handleTabClose(file.id)}
                hasUnsavedChanges={unsavedFileIds.has(file.id)}
                tabType={
                  file.nodeType === 'trends'
                    ? 'trends'
                    : file.nodeType === 'status'
                    ? 'status'
                    : file.nodeType === 'controller'
                    ? 'file'
                    : 'file'
                }
              />
            ))}
          </div>
          <div className="flex-1 h-full">
            {activeFile?.nodeType === 'trends' ? (
              <TrendsTab file={activeFile} />
            ) : activeFile?.nodeType === 'status' ? (
              <StatusScreen file={activeFile} />
            ) : (
              <EditorErrorBoundary>
                <Editor
                  height="calc(100vh - 6rem)"
                  defaultLanguage="plaintext"
                  theme={monacoTheme}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: 'on',
                  }}
                />
              </EditorErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* New File Dialog */}
      {fileDialog.isOpen && (
        <NewFileDialog
          isOpen={fileDialog.isOpen}
          isFolder={fileDialog.isFolder}
          onClose={() => setFileDialog({ ...fileDialog, isOpen: false })}
          onSubmit={createNewFileOrFolder}
        />
      )}
      {/* Delete Dialog */}
      {deleteDialog.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
            <p className="mb-6">
              Are you sure you want to delete{' '}
              <span className="font-bold">{deleteDialog.node?.name}</span>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialog({ isOpen: false, node: null })}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonacoEditor;
