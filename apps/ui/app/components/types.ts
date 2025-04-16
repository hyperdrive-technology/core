// Define the file tree data structure
export interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
  nodeType?:
    | 'heading'
    | 'controller'
    | 'file'
    | 'folder'
    | 'trends'
    | 'status'
    | 'compile'
    | 'control';
  metadata?: {
    ip?: string;
    version?: string;
    description?: string;
    tags?: string[];
    [key: string]: any;
  };
  path?: string; // Add path property which might be needed for some node types
}
