import { createServerFn } from '@tanstack/react-start';
import fs from 'fs';
import path from 'path';

// Define the FileNode interface for our file system representation
export interface FileNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
}

// Server function to load example projects
export const loadExampleProjects = createServerFn().handler(async () => {
  try {
    // This will run on the server side
    const examplesDir = path.join(process.cwd(), 'examples');
    return await scanDirectory(examplesDir, 'examples');
  } catch (error) {
    console.error('Error loading example projects:', error);
    return [];
  }
});

// Recursively scan a directory and build the file tree
async function scanDirectory(
  dirPath: string,
  baseName: string,
): Promise<FileNode[]> {
  try {
    const entries = fs.readdirSync(dirPath);
    let id = 0;

    const nodes: FileNode[] = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(dirPath, entry);
        const stats = fs.statSync(entryPath);
        const uniqueId = `${baseName}-${entry}-${id++}`;

        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const children = await scanDirectory(entryPath, uniqueId);
          return {
            id: uniqueId,
            name: entry,
            isFolder: true,
            children,
          };
        } else {
          // Read file content
          let content = '';
          try {
            content = fs.readFileSync(entryPath, 'utf8');
            // Ensure the content is properly escaped and handled
            if (content && typeof content === 'string') {
              console.log(`Loaded file: ${entry} (${content.length} bytes)`);
            } else {
              console.warn(`File ${entry} has invalid content`);
              content = '';
            }
          } catch (e) {
            console.error(`Error reading file ${entryPath}:`, e);
          }

          return {
            id: uniqueId,
            name: entry,
            isFolder: false,
            content,
          };
        }
      }),
    );

    return nodes;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return [];
  }
}
