// Define the file tree data structure
export interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
  nodeType?: 'heading' | 'controller' | 'file' | 'folder' | 'trends';
  metadata?: {
    ip?: string;
    version?: string;
    description?: string;
    [key: string]: any;
  };
}
