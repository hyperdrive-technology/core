import { cn } from '@/lib/utils';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import {
  ChevronDown,
  ChevronRight,
  FileIcon,
  FolderIcon,
  X,
} from 'lucide-react';
import { editor } from 'monaco-editor';
import { Resizable } from 're-resizable';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IEC61131_LANGUAGE_ID,
  registerIEC61131Language,
} from '../server/iec61131/language-service';

// Define the file tree data structure
interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
}

// Sample file structure - replace with your actual data
const defaultFiles: FileNode[] = [
  {
    id: '1',
    name: 'src',
    isFolder: true,
    children: [
      {
        id: '2',
        name: 'components',
        isFolder: true,
        children: [
          {
            id: '3',
            name: 'App.tsx',
            isFolder: false,
            content:
              'import React from "react";\n\nconst App = () => {\n  return <div>Hello World</div>;\n};\n\nexport default App;',
          },
        ],
      },
      {
        id: '4',
        name: 'index.ts',
        isFolder: false,
        content: 'console.log("Hello world!");\n',
      },
    ],
  },
  {
    id: '5',
    name: 'package.json',
    isFolder: false,
    content: '{\n  "name": "example",\n  "version": "1.0.0"\n}',
  },
  {
    id: '6',
    name: 'examples',
    isFolder: true,
    children: [
      {
        id: '7',
        name: 'test.st',
        isFolder: false,
        content: `(*
  IEC 61131-3 Structured Text Example
  This example demonstrates various features of IEC 61131-3 ST
*)

// Single line comment example

PROGRAM TemperatureControl
  VAR_INPUT
    RoomTemperature : REAL; // Current temperature in Celsius
    SetPoint : REAL := 22.5; // Default setpoint
    ManualOverride : BOOL := FALSE;
  END_VAR

  VAR_OUTPUT
    HeatingOutput : REAL; // 0-100% heating control
    CoolingOutput : REAL; // 0-100% cooling control
    AlarmActive : BOOL := FALSE;
  END_VAR

  VAR
    TemperatureDifference : REAL;
    PreviousError : REAL := 0.0;
    IntegralTerm : REAL := 0.0;
    DerivativeTerm : REAL := 0.0;
    // PID constants
    Kp : REAL := 2.5;  // Proportional gain
    Ki : REAL := 0.5;  // Integral gain
    Kd : REAL := 0.1;  // Derivative gain
    ControlOutput : REAL;
    SampleTime : REAL := 0.1; // Sample time in seconds
    TemperatureArray : ARRAY [0..9] OF REAL; // Store last 10 temperature readings
    TemperatureIndex : INT := 0;
    TemperatureStats : STRUCT
      Min : REAL := 100.0;
      Max : REAL := -100.0;
      Average : REAL := 0.0;
    END_STRUCT;
  END_VAR

BEGIN
  // Calculate temperature difference (error)
  TemperatureDifference := SetPoint - RoomTemperature;

  // Update temperature history array
  TemperatureArray[TemperatureIndex] := RoomTemperature;
  TemperatureIndex := (TemperatureIndex + 1) MOD 10;

  // PID control algorithm
  IF NOT ManualOverride THEN
    // Proportional term
    ControlOutput := Kp * TemperatureDifference;

    // Integral term
    IntegralTerm := IntegralTerm + Ki * TemperatureDifference * SampleTime;

    // Derivative term
    DerivativeTerm := Kd * (TemperatureDifference - PreviousError) / SampleTime;

    // Calculate control output
    ControlOutput := ControlOutput + IntegralTerm + DerivativeTerm;

    // Limit control output to valid range [-100, 100]
    IF ControlOutput > 100.0 THEN
      ControlOutput := 100.0;
    ELSIF ControlOutput < -100.0 THEN
      ControlOutput := -100.0;
    END_IF;

    // Save current error for next cycle
    PreviousError := TemperatureDifference;
  END_IF;

  // Update outputs based on control signal
  IF ControlOutput > 0.0 THEN
    // Heating mode
    HeatingOutput := ControlOutput;
    CoolingOutput := 0.0;
  ELSE
    // Cooling mode
    HeatingOutput := 0.0;
    CoolingOutput := -ControlOutput;
  END_IF;

  // Calculate min, max and average temperature
  TemperatureStats.Min := 100.0;
  TemperatureStats.Max := -100.0;
  TemperatureStats.Average := 0.0;

  // FOR loop example
  FOR i := 0 TO 9 DO
    TemperatureStats.Average := TemperatureStats.Average + TemperatureArray[i];

    // Check for min/max values
    IF TemperatureArray[i] < TemperatureStats.Min THEN
      TemperatureStats.Min := TemperatureArray[i];
    END_IF;

    IF TemperatureArray[i] > TemperatureStats.Max THEN
      TemperatureStats.Max := TemperatureArray[i];
    END_IF;
  END_FOR;

  // Divide by array size to get average
  TemperatureStats.Average := TemperatureStats.Average / 10.0;

  // WHILE loop example - alarm detection
  AlarmActive := FALSE;

  WHILE NOT AlarmActive AND (TemperatureStats.Max - TemperatureStats.Min) > 10.0 DO
    // Activate alarm if temperature fluctuation is too high
    AlarmActive := TRUE;
  END_WHILE;

  // REPEAT loop example
  REPEAT
    // Simulation of a one-shot action when an alarm is raised
    IF AlarmActive AND ABS(RoomTemperature - SetPoint) > 15.0 THEN
      // Emergency override
      HeatingOutput := 0.0;
      CoolingOutput := 0.0;
    END_IF;
  UNTIL NOT AlarmActive OR ABS(RoomTemperature - SetPoint) <= 10.0
  END_REPEAT;
END
END_PROGRAM

FUNCTION CalculateHeatIndex : REAL
  VAR_INPUT
    Temperature : REAL; // Temperature in Celsius
    Humidity : REAL;    // Relative humidity in %
  END_VAR

  VAR
    TempF : REAL;      // Temperature in Fahrenheit
    HeatIndexF : REAL; // Heat index in Fahrenheit
    HeatIndexC : REAL; // Heat index in Celsius
  END_VAR

BEGIN
  // Convert Celsius to Fahrenheit
  TempF := (Temperature * 9.0 / 5.0) + 32.0;

  // Calculate heat index using the formula
  HeatIndexF := -42.379 + (2.04901523 * TempF) + (10.14333127 * Humidity);
  HeatIndexF := HeatIndexF - (0.22475541 * TempF * Humidity);
  HeatIndexF := HeatIndexF - (0.00683783 * TempF * TempF);
  HeatIndexF := HeatIndexF - (0.05481717 * Humidity * Humidity);
  HeatIndexF := HeatIndexF + (0.00122874 * TempF * TempF * Humidity);
  HeatIndexF := HeatIndexF + (0.00085282 * TempF * Humidity * Humidity);
  HeatIndexF := HeatIndexF - (0.00000199 * TempF * TempF * Humidity * Humidity);

  // Convert back to Celsius
  HeatIndexC := (HeatIndexF - 32.0) * 5.0 / 9.0;

  // Return the result
  CalculateHeatIndex := HeatIndexC;
END
END_FUNCTION

FUNCTION_BLOCK TemperatureController
  VAR_INPUT
    ActualTemperature : REAL;
    SetPoint : REAL;
    Enable : BOOL := TRUE;
  END_VAR

  VAR_OUTPUT
    HeatingOutput : REAL;
    CoolingOutput : REAL;
    Status : INT := 0; // 0: Idle, 1: Heating, 2: Cooling, 3: Error
  END_VAR

  VAR
    Error : REAL;
    Kp : REAL := 2.0;
    OutputValue : REAL;
    DeadbandLow : REAL := -0.5;
    DeadbandHigh : REAL := 0.5;
  END_VAR

BEGIN
  IF Enable THEN
    // Calculate error
    Error := SetPoint - ActualTemperature;

    // Simple P control with deadband
    IF Error > DeadbandHigh THEN
      // Need heating
      OutputValue := Kp * Error;
      HeatingOutput := OutputValue;
      CoolingOutput := 0.0;
      Status := 1; // Heating mode
    ELSIF Error < DeadbandLow THEN
      // Need cooling
      OutputValue := Kp * ABS(Error);
      HeatingOutput := 0.0;
      CoolingOutput := OutputValue;
      Status := 2; // Cooling mode
    ELSE
      // Within deadband - no action needed
      HeatingOutput := 0.0;
      CoolingOutput := 0.0;
      Status := 0; // Idle
    END_IF;
  ELSE
    // Controller disabled
    HeatingOutput := 0.0;
    CoolingOutput := 0.0;
    Status := 0;
  END_IF;
END
END_FUNCTION_BLOCK`,
      },
    ],
  },
];

// Tree Node Component
const TreeNode: React.FC<{
  node: FileNode;
  level: number;
  onSelectFile: (node: FileNode) => void;
  selectedFileId: string | null;
}> = ({ node, level, onSelectFile, selectedFileId }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isFolder) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.isFolder) {
      // Create a fresh copy of the node to ensure it's not stale
      const freshNode: FileNode = {
        ...node,
        content: node.content,
      };

      onSelectFile(freshNode);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none',
          selectedFileId === node.id &&
            !node.isFolder &&
            'bg-blue-100 dark:bg-blue-900',
        )}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={handleSelect}
      >
        {node.isFolder ? (
          <span className="flex items-center">
            {isExpanded ? (
              <ChevronDown size={16} onClick={handleToggle} />
            ) : (
              <ChevronRight size={16} onClick={handleToggle} />
            )}
            <FolderIcon size={16} className="mr-1 text-yellow-500" />
          </span>
        ) : (
          <span className="ml-5 flex items-center">
            <FileIcon size={16} className="mr-1 text-gray-500" />
          </span>
        )}
        <span className="ml-1">{node.name}</span>
      </div>

      {node.isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onSelectFile={onSelectFile}
              selectedFileId={selectedFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// File Explorer Component
const FileExplorer: React.FC<{
  files: FileNode[];
  onSelectFile: (node: FileNode) => void;
  selectedFileId: string | null;
}> = ({ files, onSelectFile, selectedFileId }) => {
  return (
    <div className="h-full overflow-y-auto dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="p-2 font-semibold border-b dark:border-gray-700">
        Files
      </div>
      <div>
        {files.map((file) => (
          <TreeNode
            key={file.id}
            node={file}
            level={0}
            onSelectFile={onSelectFile}
            selectedFileId={selectedFileId}
          />
        ))}
      </div>
    </div>
  );
};

// Tab Component
const EditorTab: React.FC<{
  file: FileNode;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}> = ({ file, isActive, onClick, onClose }) => {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={cn(
        'flex items-center px-3 py-2 border-r dark:border-gray-700 cursor-pointer select-none',
        isActive
          ? 'bg-white dark:bg-gray-800 border-b-2 border-b-blue-500'
          : 'bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800',
      )}
      onClick={onClick}
    >
      <FileIcon size={14} className="mr-2 text-gray-500" />
      <span className="mr-2">{file.name}</span>
      <X
        size={14}
        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        onClick={handleClose}
      />
    </div>
  );
};

// Custom hook for language client integration
function useLanguageClient(
  monaco: Monaco | null,
  editor: editor.IStandaloneCodeEditor | null,
) {
  useEffect(() => {
    if (!monaco || !editor) return;

    // Worker setup
    let worker: Worker | null = null;

    try {
      // Create language worker
      worker = new Worker(
        new URL('../workers/langium-worker.ts', import.meta.url),
        {
          type: 'module',
        },
      );

      // Handle worker messages
      worker.onmessage = (event) => {
        console.log('Message from worker:', event.data);

        // Handle diagnostics
        if (
          event.data.type === 'diagnostics' &&
          event.data.uri &&
          event.data.diagnostics
        ) {
          const model = monaco.editor.getModel(
            monaco.Uri.parse(event.data.uri),
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
              })),
            );
          }
        }
      };

      // Add editor change listener
      const model = editor.getModel();
      if (model) {
        const disposable = model.onDidChangeContent(() => {
          worker?.postMessage({
            type: 'documentChange',
            uri: model.uri.toString(),
            content: model.getValue(),
          });
        });

        return () => {
          disposable.dispose();
          worker?.terminate();
        };
      }
    } catch (error) {
      console.error('Error initializing language worker:', error);
    }

    return () => {
      worker?.terminate();
    };
  }, [monaco, editor]);
}

// Update the component to accept initialFiles prop
interface MonacoEditorProps {
  initialFiles?: FileNode[];
}

const MonacoEditor = ({ initialFiles }: MonacoEditorProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [files, setFiles] = useState<FileNode[]>(initialFiles ?? defaultFiles);
  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [loadingExamples, setLoadingExamples] = useState(false);

  // Auto-open the first file from initialFiles if provided
  useEffect(() => {
    if (
      initialFiles &&
      initialFiles.length > 0 &&
      editorReady &&
      !activeFileId
    ) {
      // Find the first non-folder file to open
      const findFirstFile = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          // Prefer .st files first (IEC61131 files)
          if (!node.isFolder && node.name.endsWith('.st')) {
            return node;
          }
        }

        // If no .st file found, look for any file
        for (const node of nodes) {
          if (!node.isFolder) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const file = findFirstFile(node.children);
            if (file) return file;
          }
        }
        return null;
      };

      const fileToOpen = findFirstFile(initialFiles);
      if (fileToOpen) {
        console.log('Auto-opening file:', fileToOpen.name);

        // Add to open files
        setOpenFiles((prev) => [...prev, fileToOpen]);

        // Set as active file
        setActiveFileId(fileToOpen.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles, editorReady]);

  // Function to load examples from the file system
  const loadExampleProjects = useCallback(async () => {
    try {
      setLoadingExamples(true);
      const response = await fetch('/api/examples');

      if (!response.ok) {
        throw new Error(`Error fetching examples: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.examples && Array.isArray(data.examples)) {
        // Create IEC61131 projects node
        const projectsNode: FileNode = {
          id: 'filesystem-examples',
          name: 'IEC61131 Projects',
          isFolder: true,
          children: data.examples,
        };

        // Add to files
        setFiles((prevFiles) => [...prevFiles, projectsNode]);
      }
    } catch (error) {
      console.error('Failed to load example projects:', error);
    } finally {
      setLoadingExamples(false);
    }
  }, []);

  // Load examples on component mount
  useEffect(() => {
    loadExampleProjects();
  }, [loadExampleProjects]);

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

  // Handle editor mounting
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Set the initial theme
    monaco.editor.setTheme(monacoTheme);

    // Register the IEC61131 language (Structured Text)
    registerIEC61131Language(monaco);

    // Configure Monaco if needed
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2015,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      typeRoots: ['node_modules/@types'],
    });

    // Mark editor as ready
    setEditorReady(true);

    // Check if we have an active file that needs to be displayed
    if (activeFileId) {
      const fileToDisplay = openFiles.find((file) => file.id === activeFileId);
      if (fileToDisplay) {
        // Use setTimeout to ensure the editor is fully initialized
        setTimeout(() => {
          updateEditorContent(fileToDisplay);
        }, 100);
      }
    }
  };

  // Use our custom language client hook
  useLanguageClient(monacoRef.current, editorRef.current);

  // Get active file
  const activeFile = openFiles.find((file) => file.id === activeFileId) || null;

  // Function to update editor content
  const updateEditorContent = useCallback((file: FileNode) => {
    if (!editorRef.current || !monacoRef.current) {
      console.warn('Editor not ready yet');
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

    try {
      // Create a unique URI for the model
      const uri = monacoRef.current.Uri.parse(`file:///${file.id}`);

      // Check if a model with this URI already exists
      let model = monacoRef.current.editor.getModel(uri);

      if (model) {
        model.setValue(file.content || '');
      } else {
        model = monacoRef.current.editor.createModel(
          file.content || '',
          language,
          uri,
        );
      }

      // Set the model to the editor
      editorRef.current.setModel(model);
    } catch (error) {
      console.error('Error updating editor content:', error);

      // Fallback to the old method
      editorRef.current.setValue(file.content || '');
    }

    // Focus the editor
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 100);
  }, []);

  // Handle file selection
  const handleSelectFile = useCallback(
    (node: FileNode) => {
      if (!node.isFolder) {
        // Check if file is already open
        const isFileOpen = openFiles.some((file) => file.id === node.id);

        if (!isFileOpen) {
          // Add to open files
          setOpenFiles((prev) => [...prev, node]);
        }

        // Set as active file
        setActiveFileId(node.id);

        // Ensure we have a reference to the editor before trying to update content
        if (!editorRef.current || !monacoRef.current) {
          // We'll update the content when the editor is ready via the useEffect below
          return;
        }

        // Update editor content immediately
        updateEditorContent(node);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [openFiles, updateEditorContent],
  );

  // Update editor content when activeFileId changes
  useEffect(() => {
    if (activeFileId && editorRef.current && monacoRef.current) {
      const activeFile = openFiles.find((file) => file.id === activeFileId);

      if (activeFile) {
        // Force a delay before updating content to ensure the editor is ready
        setTimeout(() => {
          updateEditorContent(activeFile);
        }, 50);
      }
    }
  }, [activeFileId, openFiles, updateEditorContent]);

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

    const updateContent = () => {
      const updateFileContent = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === activeFile.id) {
            return {
              ...node,
              content: editorRef.current?.getValue() || '',
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
          file.id === activeFile.id
            ? { ...file, content: editorRef.current?.getValue() || '' }
            : file,
        ),
      );
    };

    const disposable = editorRef.current.onDidChangeModelContent(() => {
      updateContent();
    });

    return () => {
      disposable.dispose();
    };
  }, [activeFile, files]);

  // Update files if initialFiles changes
  useEffect(() => {
    if (initialFiles) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  return (
    <div className="h-full flex flex-col">
      {/* Loading indicator */}
      {loadingExamples && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white px-2 py-1 text-xs">
          Loading examples...
        </div>
      )}
      <div className="h-full flex">
        <Resizable
          defaultSize={{ width: 250, height: '100%' }}
          minWidth={200}
          maxWidth={400}
          enable={{ right: true }}
          className="border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
        >
          <FileExplorer
            files={files}
            onSelectFile={handleSelectFile}
            selectedFileId={activeFileId}
          />
        </Resizable>

        <div className="flex-1 flex flex-col h-full">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="text-sm flex border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-900 overflow-x-auto">
              {openFiles.map((file) => (
                <EditorTab
                  key={file.id}
                  file={file}
                  isActive={file.id === activeFileId}
                  onClick={() => handleTabClick(file.id)}
                  onClose={() => handleTabClose(file.id)}
                />
              ))}
            </div>
          )}

          {/* Editor */}
          <div className="flex-1">
            {activeFile ? (
              <Editor
                height="100%"
                defaultLanguage="javascript"
                defaultValue=""
                theme={monacoTheme}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  tabSize: 2,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a file to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonacoEditor;
