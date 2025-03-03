import { cn } from '@/lib/utils';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { ChevronDown, ChevronRight, FileIcon, FolderIcon } from 'lucide-react';
import { editor } from 'monaco-editor';
import { Resizable } from 're-resizable';
import React, { useEffect, useRef, useState } from 'react';

// Define the file tree data structure
interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
}

// Sample file structure - replace with your actual data
const initialFiles: FileNode[] = [
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

  const handleSelect = () => {
    if (!node.isFolder) {
      onSelectFile(node);
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
          <span onClick={handleToggle} className="flex items-center">
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
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
    <div className="h-full overflow-y-auto border-r dark:border-gray-700 bg-white dark:bg-gray-900">
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

// Main Monaco Editor Component
const MonacoEditor: React.FC = () => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Handle editor mounting
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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
  };

  // Use our custom language client hook
  useLanguageClient(monacoRef.current, editorRef.current);

  // Handle file selection
  const handleSelectFile = (node: FileNode) => {
    if (!node.isFolder) {
      setSelectedFile(node);
      setSelectedFileId(node.id);

      // Update editor content
      if (editorRef.current) {
        editorRef.current.setValue(node.content || '');

        // Determine language by file extension
        const extension = node.name.split('.').pop()?.toLowerCase();
        let language = 'plaintext';

        if (extension === 'js') language = 'javascript';
        if (extension === 'ts') language = 'typescript';
        if (extension === 'jsx' || extension === 'tsx') language = 'typescript';
        if (extension === 'json') language = 'json';
        if (extension === 'html') language = 'html';
        if (extension === 'css') language = 'css';

        // Set language mode
        if (monacoRef.current) {
          monacoRef.current.editor.setModelLanguage(
            editorRef.current.getModel()!,
            language,
          );
        }
      }
    }
  };

  // Update file content when editor changes
  useEffect(() => {
    if (!editorRef.current || !selectedFile) return;

    const updateContent = () => {
      const updateFileContent = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === selectedFile.id) {
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

      setFiles(updateFileContent(files));
    };

    const disposable = editorRef.current.onDidChangeModelContent(() => {
      updateContent();
    });

    return () => {
      disposable.dispose();
    };
  }, [selectedFile, files]);

  return (
    <div className="w-full h-[calc(100vh-64px)] flex">
      <Resizable
        defaultSize={{ width: 250, height: '100%' }}
        minWidth={200}
        maxWidth={400}
        enable={{ right: true }}
      >
        <FileExplorer
          files={files}
          onSelectFile={handleSelectFile}
          selectedFileId={selectedFileId}
        />
      </Resizable>

      <div className="flex-1 h-full">
        {selectedFile ? (
          <Editor
            height="100%"
            defaultLanguage="typescript"
            defaultValue={selectedFile.content || ''}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14,
              tabSize: 2,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
};

export default MonacoEditor;
