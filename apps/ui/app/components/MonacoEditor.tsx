import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Editor, Monaco, OnMount } from '@monaco-editor/react';
import { ChevronLeft, ChevronRight, File, X } from 'lucide-react';
import { editor } from 'monaco-editor';
import { Resizable } from 're-resizable';
import React, {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { useIECCompiler } from '../hooks/useIECCompiler';
import { useMonacoLanguageClient } from '../hooks/useMonacoLanguageClient';
import { IECFile } from '../utils/iec-file-loader';
import {
  IEC61131_LANGUAGE_ID,
  registerIEC61131Language,
} from '../workers/lsp/language-service';
import BreadcrumbPath from './BreadcrumbPath';
import { CommandBar } from './CommandBar';
import { CompilePanel } from './CompilePanel';
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
  // All state variables should be defined at the top
  const [files, setFiles] = useState<FileNode[]>(initialFiles || []);
  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  // Remove this unused static connected state
  const [iecFiles, setIecFiles] = useState<IECFile[]>([]);

  const [unsavedFileIds, setUnsavedFileIds] = useState<Set<string>>(new Set());
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationResult, setCompilationResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Add a state for tracking the current project/folder
  // Use provided projectName from props if available, otherwise default
  const [currentProjectName, setCurrentProjectName] = useState<string>(
    projectName || 'Hyperdrive Project'
  );

  // IEC Compiler hook - moved to top of component
  const {
    compile,
    result: compilerResult,
    status: compilerStatus,
    error: compilerError,
  } = useIECCompiler();

  // Log compiler initialization
  useEffect(() => {
    console.log('IEC Compiler hook initialized, status:', compilerStatus);
  }, []);

  // Ensure a stable reference to compile function
  const safeCompile = useCallback(
    (files: IECFile[]) => {
      console.log('Safely compiling files:', files.length);
      try {
        compile(files);
      } catch (err) {
        console.error('Error calling compile function:', err);
        setIsCompiling(false);
        setCompilationResult({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [compile]
  );

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
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

  // State for tracking unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasChangesSinceCompilation, setHasChangesSinceCompilation] =
    useState(false);

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

  // Use our custom language client hook
  useMonacoLanguageClient(monacoRef.current, editorRef.current);

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
    try {
      console.log('Registering IEC61131 language...');
      registerIEC61131Language(monaco);
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
    setTimeout(() => {
      console.log('Setting editor as ready');
      setEditorReady(true);
    }, 100);

    // Initialize the IEC 61131-3 language services
    import('../workers/lsp/lsp-monaco-setup')
      .then(({ setupLSPMonaco }) => {
        console.log('Setting up Monaco integration...');
        // Set up the language services
        setupLSPMonaco(monaco);
      })
      .catch((error) => {
        console.error('Error setting up Monaco integration:', error);
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
  const { controllers, connect, disconnect, addController, isConnected } =
    useWebSocket();

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

  // When content changes, set unsaved changes to true
  const handleContentChange = useCallback(() => {
    if (activeFileId && editorRef.current) {
      const currentContent = editorRef.current.getValue();
      const activeFile = openFiles.find((file) => file.id === activeFileId);

      if (activeFile && currentContent !== activeFile.content) {
        setHasUnsavedChanges(true);
        setHasChangesSinceCompilation(true);
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
        // We don't reset hasChangesSinceCompilation here because we want to track changes since last compilation
        // not since last save
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

  // Find all ST files under the Logic section (renamed from Control)
  const findAllSTFiles = useCallback(() => {
    // Debug the file structure to see what we're working with
    console.log('Available files:', files);

    // Be more flexible in finding logic-related sections
    let logicSection = files.find(
      (node) =>
        node.name?.toLowerCase() === 'logic' ||
        node.id?.toLowerCase() === 'logic-section' ||
        node.id?.toLowerCase()?.includes('logic') ||
        node.name?.toLowerCase()?.includes('logic')
    );

    // If we're looking at example-2, the structure might be different
    if (!logicSection) {
      // Look for any node that might contain example-2 in the id or name
      const example2Node = files.find(
        (node) =>
          node.id?.toLowerCase()?.includes('example-2') ||
          node.name?.toLowerCase()?.includes('example-2')
      );

      if (example2Node) {
        console.log('Found example-2 node:', example2Node);
        // If we found an example-2 node, it might be the root or container
        if (example2Node.children && example2Node.children.length > 0) {
          // First, see if there's a logic folder in its children
          logicSection = example2Node.children.find(
            (child) =>
              child.name?.toLowerCase() === 'logic' ||
              child.id?.toLowerCase()?.includes('logic')
          );

          // If still not found, check if the example-2 node itself has ST files
          if (!logicSection) {
            const stFilesInExample2: FileNode[] = [];
            const collectSTFiles = (node: FileNode) => {
              if (!node.isFolder && node.name.toLowerCase().endsWith('.st')) {
                stFilesInExample2.push(node);
              }
              if (node.children) {
                node.children.forEach(collectSTFiles);
              }
            };

            collectSTFiles(example2Node);

            if (stFilesInExample2.length > 0) {
              console.log(
                `Found ${stFilesInExample2.length} ST files directly in example-2:`,
                stFilesInExample2
              );
              return stFilesInExample2;
            }
          }
        }
      }
    }

    // If Logic section still not found, let's look for any ST files in the entire tree
    if (!logicSection) {
      console.log(
        'No logic section found. Looking for any ST files in the project...'
      );
      console.log(
        'Dumping the full file tree:',
        JSON.stringify(files, null, 2)
      );

      // Look for any ST files in the project
      const allSTFiles: FileNode[] = [];

      const collectAllSTFiles = (nodes: FileNode[]) => {
        for (const node of nodes) {
          // Log each file we're checking to see where the issue might be
          console.log(
            `Checking node: ${node.name}, isFolder: ${node.isFolder}, id: ${node.id}`
          );

          if (!node.isFolder && node.name.toLowerCase().endsWith('.st')) {
            console.log(`Found ST file: ${node.name}`);
            allSTFiles.push(node);
          }

          if (node.children && node.children.length > 0) {
            console.log(
              `Checking children of ${node.name} (${node.children.length} children)`
            );
            collectAllSTFiles(node.children);
          }
        }
      };

      collectAllSTFiles(files);

      if (allSTFiles.length > 0) {
        console.log(
          `Found ${allSTFiles.length} ST files in the project:`,
          allSTFiles
        );
        return allSTFiles;
      }

      console.error('No ST files found in the entire project');
      return [];
    }

    console.log('Found Logic section:', logicSection);

    // Debug: Dump the full Logic section to inspect its structure
    console.log(
      'Logic section structure:',
      JSON.stringify(logicSection, null, 2)
    );

    if (logicSection.children) {
      console.log(
        `Logic has ${logicSection.children.length} children:`,
        logicSection.children
      );
    }

    const stFiles: FileNode[] = [];

    // Recursive function to traverse the file tree
    const collectSTFiles = (node: FileNode) => {
      // Log every node we're checking
      console.log(`Checking for ST: ${node.name}, isFolder: ${node.isFolder}`);

      if (!node.isFolder && node.name.toLowerCase().endsWith('.st')) {
        console.log(`Found ST file: ${node.name}`);
        stFiles.push(node);
      }

      if (node.children && node.children.length > 0) {
        console.log(
          `Traversing ${node.children.length} children of ${node.name}`
        );
        node.children.forEach(collectSTFiles);
      }
    };

    // Start collection from the Logic section
    if (logicSection.children) {
      logicSection.children.forEach(collectSTFiles);
    } else {
      // If logicSection has no children but is itself an ST file
      if (
        !logicSection.isFolder &&
        logicSection.name.toLowerCase().endsWith('.st')
      ) {
        stFiles.push(logicSection);
      }
    }

    console.log(`Found ${stFiles.length} ST files under Logic section`);
    return stFiles;
  }, [files]);

  // Modified compile function to handle all files under Logic
  const handleCompile = useCallback(async () => {
    // Find all ST files under Logic section
    const stFiles = findAllSTFiles();

    if (stFiles.length === 0) {
      toast.error('No IEC-61131 files found', {
        description:
          'Could not find any .st files in the Logic section. Please ensure there are .st files in your project.',
      });
      return false;
    }

    setIsCompiling(true);
    setCompilationResult(null);
    // Reset the hasChangesSinceCompilation flag when compilation starts
    setHasChangesSinceCompilation(false);

    // Show notification about what's being compiled
    toast.info('Compiling code', {
      description: `Compiling ${stFiles.length} IEC-61131 file(s) in the browser`,
    });

    try {
      // Convert FileNodes to IECFiles for the compiler
      const iecFilesToCompile: IECFile[] = stFiles.map((file) => ({
        fileName: file.name,
        content: file.content || '',
      }));

      // Update the state with these files
      setIecFiles(iecFilesToCompile);

      // Use our compiler hook to compile in the browser
      safeCompile(iecFilesToCompile);

      // We'll handle the result in a useEffect that watches compilerResult
      return true;
    } catch (error) {
      console.error('Compilation error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setCompilationResult({ success: false, error: errorMessage });
      toast.error('Compilation failed', {
        description: errorMessage,
      });
      setIsCompiling(false);
      return false;
    }
  }, [findAllSTFiles, toast, safeCompile]);

  // Update iecFiles when files change
  useEffect(() => {
    const stFiles = findAllSTFiles();
    const newIecFiles = stFiles.map((file) => ({
      fileName: file.name,
      content: file.content || '',
    }));
    setIecFiles(newIecFiles);
  }, [files, findAllSTFiles]);

  // Add a useEffect to handle compilation results
  useEffect(() => {
    // Only run this effect if we have status information from the compiler
    if (compilerStatus === 'success' || compilerStatus === 'error') {
      console.log('📋 Compiler status changed:', compilerStatus);
      console.log('📋 Compiler result:', compilerResult);
      console.log('📋 Compiler error:', compilerError);

      setIsCompiling(false);

      if (compilerStatus === 'success' && compilerResult?.success) {
        setCompilationResult({ success: true });
        // Store the result AST for later deployment
        if (compilerResult.ast) {
          console.log('📋 Compilation succeeded with AST:', compilerResult.ast);
        }

        toast.success('Compilation successful', {
          description: `Successfully compiled ${compilerResult.fileCount} file(s)`,
        });
      } else {
        setCompilationResult({
          success: false,
          error: compilerError || 'Compilation failed with errors',
        });

        toast.error('Compilation failed', {
          description: compilerError || 'Check the compile panel for details',
        });
      }
    }
    // This effect was removed and replaced with the one at the top of the component
  }, []);

  // Deploy function that compiles first if there are changes
  const handleDeploy = useCallback(async () => {
    // Always compile if there are changes since last compilation
    if (hasChangesSinceCompilation) {
      toast.info('Compiling before deployment', {
        description: 'Changes detected since last compilation',
      });

      // Start compilation
      const compileSuccess = await handleCompile();
      if (!compileSuccess) {
        toast.error('Deployment canceled', {
          description:
            'Cannot deploy because compilation failed. Please fix the errors first.',
        });
        return; // Don't continue if compilation failed
      }

      // Wait for compilation to complete
      // Use a promise that resolves when compilerStatus changes
      await new Promise<void>((resolve, reject) => {
        const checkCompilerStatus = () => {
          if (compilerStatus === 'success' && compilerResult?.success) {
            resolve();
          } else if (compilerStatus === 'error') {
            reject(new Error(compilerError || 'Compilation failed'));
          } else {
            // Check again after a short delay
            setTimeout(checkCompilerStatus, 100);
          }
        };

        checkCompilerStatus();
      }).catch((error) => {
        toast.error('Compilation failed', {
          description: error.message || 'Check the compile panel for details',
        });
        return Promise.reject(error); // Propagate the error to stop deployment
      });
    }
    // If we don't have a successful compilation result yet, compile now
    else if (!compilationResult?.success) {
      toast.info('Compiling before deployment', {
        description: 'No valid compilation found',
      });

      // Start compilation
      const compileSuccess = await handleCompile();
      if (!compileSuccess) {
        toast.error('Deployment canceled', {
          description:
            'Cannot deploy because compilation failed. Please fix the errors first.',
        });
        return; // Don't continue if compilation failed
      }

      // Wait for compilation to complete
      // Use a promise that resolves when compilerStatus changes
      await new Promise<void>((resolve, reject) => {
        const checkCompilerStatus = () => {
          if (compilerStatus === 'success' && compilerResult?.success) {
            resolve();
          } else if (compilerStatus === 'error') {
            reject(new Error(compilerError || 'Compilation failed'));
          } else {
            // Check again after a short delay
            setTimeout(checkCompilerStatus, 100);
          }
        };

        checkCompilerStatus();
      }).catch((error) => {
        toast.error('Compilation failed', {
          description: error.message || 'Check the compile panel for details',
        });
        return Promise.reject(error); // Propagate the error to stop deployment
      });
    }

    // Now deploy the compiled code if we have an AST
    if (compilerResult?.ast) {
      setIsDeploying(true);

      try {
        // Deploy the AST to the controller
        const response = await fetch('http://localhost:3000/api/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ast: compilerResult.ast }),
        });

        if (!response.ok) {
          throw new Error(`Deployment failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Deployment result:', result);

        toast.success('Deployment successful', {
          description: `Successfully deployed to controller`,
        });
      } catch (error) {
        console.error('Deployment error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        toast.error('Deployment failed', {
          description: errorMessage,
        });
      } finally {
        setIsDeploying(false);
      }
    } else {
      toast.error('No compiled code available', {
        description: 'Please compile your code first before deploying',
      });
    }
  }, [
    handleCompile,
    hasChangesSinceCompilation,
    compilationResult,
    compilerResult,
    compilerStatus,
    compilerError,
    setIsDeploying,
  ]);

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

  // Improved function to determine current function name based on cursor position
  const getCurrentFunctionName = () => {
    if (!editorRef.current || !activeFile || activeFile.nodeType !== 'file') {
      return undefined;
    }

    try {
      const position = editorRef.current.getPosition();
      if (!position) return undefined;

      const model = editorRef.current.getModel();
      if (!model) return undefined;

      // Get the current content and split into lines
      const content = model.getValue();
      const lines = content.split('\n');

      // Current line for reference
      const currentLineNumber = position.lineNumber - 1; // 0-based index

      // Track nesting level to handle nested functions
      let nestingLevel = 0;
      let currentFunction = undefined;

      // First, check if we're inside a function by scanning from the top
      for (let i = 0; i <= currentLineNumber; i++) {
        const line = lines[i].trim();

        // Check for function start declarations
        const functionStartMatch = line.match(
          /\b(FUNCTION|FUNCTION_BLOCK|PROGRAM)\s+(\w+)/i
        );
        if (functionStartMatch) {
          nestingLevel++;
          currentFunction = functionStartMatch[2];
        }

        // Check for function end declarations
        if (line.match(/\b(END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM)\b/i)) {
          nestingLevel--;
          if (nestingLevel === 0) {
            currentFunction = undefined;
          }
        }
      }

      // If we're in a function, return it
      if (nestingLevel > 0 && currentFunction) {
        return currentFunction;
      }

      // Fallback: search backwards from cursor position for the closest function
      for (let i = currentLineNumber; i >= 0; i--) {
        const line = lines[i].trim();

        // Check for function declarations
        const functionMatch = line.match(
          /\b(FUNCTION|FUNCTION_BLOCK|PROGRAM)\s+(\w+)/i
        );
        if (functionMatch) {
          return functionMatch[2]; // Return function name
        }

        // If we find an END_FUNCTION, we need to skip back past its beginning
        if (line.match(/\b(END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM)\b/i)) {
          let skipNestingLevel = 1;

          // Keep going backward until we find the matching function start
          while (i > 0 && skipNestingLevel > 0) {
            i--;
            const prevLine = lines[i].trim();

            if (
              prevLine.match(/\b(FUNCTION|FUNCTION_BLOCK|PROGRAM)\s+(\w+)/i)
            ) {
              skipNestingLevel--;
            }
            if (
              prevLine.match(
                /\b(END_FUNCTION|END_FUNCTION_BLOCK|END_PROGRAM)\b/i
              )
            ) {
              skipNestingLevel++;
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error getting current function:', error);
      return undefined;
    }
  };

  // Update the isCompileDisabled check
  const isCompileDisabled = useCallback(() => {
    // Only disable if we're actively compiling
    return isCompiling;
  }, [isCompiling]);

  // This effect sets up initial watch on the compiler status and runs once
  useEffect(() => {
    if (
      compilerStatus &&
      (compilerStatus === 'success' || compilerStatus === 'error')
    ) {
      console.log('🔄 Compiler status updated:', compilerStatus);
      setIsCompiling(false);

      if (compilerStatus === 'success' && compilerResult?.success) {
        toast.success('Compilation successful');
      } else if (compilerStatus === 'error') {
        toast.error('Compilation failed');
      }
    }
  }, [compilerStatus, compilerResult]);

  return (
    <div className="flex flex-col">
      <CommandBar
        projectName={currentProjectName}
        onDeploy={handleDeploy}
        onCompile={handleCompile}
        hasChangesSinceCompilation={hasChangesSinceCompilation}
        isDeploying={isDeploying}
        isCompiling={isCompiling}
        isCompileDisabled={isCompileDisabled()}
        isDeployDisabled={isDeploying || isCompileDisabled()}
      />
      <div className="h-full flex">
        <Resizable
          defaultSize={{ width: '20%' }}
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

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b overflow-x-auto">
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

          {/* Breadcrumbs */}
          {activeFile && (
            <BreadcrumbPath
              path={activeFile.path || ''}
              filePath={activeFile.path}
              fileName={activeFile.name}
              activeFileId={activeFile.id}
              repoName={currentProjectName.replace(/\s+/g, '-').toLowerCase()}
              currentFunction={
                activeFile.nodeType === 'file'
                  ? getCurrentFunctionName()
                  : undefined
              }
              onSelectFile={(fileNode) => {
                console.log(
                  'MonacoEditor: Selecting file node from breadcrumb:',
                  fileNode.name
                );
                handleSelectFile(fileNode, true);
              }}
              fileTree={files}
            />
          )}

          <div className="flex-1 h-full">
            {activeFile?.nodeType === 'trends' ? (
              <TrendsTab file={activeFile} />
            ) : activeFile?.nodeType === 'status' ? (
              <StatusScreen file={activeFile} />
            ) : (
              <EditorErrorBoundary>
                <Editor
                  height="50vh"
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

          {/* Add CompilePanel component */}
          <div className="p-4 border-t bg-background h-[36vh] overflow-scroll">
            <CompilePanel files={iecFiles} />
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
