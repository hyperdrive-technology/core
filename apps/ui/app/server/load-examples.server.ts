import { createServerFn } from '@tanstack/react-start';
import fs from 'fs';
import path from 'path';
import { FileNode } from '../components/types';

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
        const lowerName = entry.toLowerCase();
        const parentFolderName = path.basename(dirPath).toLowerCase();

        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const children = await scanDirectory(entryPath, uniqueId);

          // Check if this is one of our special heading folders
          const isHeading = ['devices', 'logic', 'control'].includes(lowerName);

          return {
            id: uniqueId,
            name: entry,
            isFolder: true,
            children,
            nodeType: isHeading ? 'heading' : 'folder',
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

          // Determine the node type based on the file extension and parent directory
          let nodeType: 'controller' | 'file' = 'file';
          let metadata = undefined;

          // Check if this is a controller file (JSON file in the devices directory)
          if (parentFolderName === 'devices' && lowerName.endsWith('.json')) {
            nodeType = 'controller';
            // Try to parse content as JSON to extract metadata
            if (content) {
              try {
                const data = JSON.parse(content);
                metadata = {
                  ip: data.ip || '127.0.0.1',
                  version: data.version || '1.0.0',
                  description: data.description || 'Controller',
                };
                console.log(
                  `Loaded controller: ${entry} with IP ${metadata.ip}`,
                );
              } catch (e) {
                console.error(`Error parsing controller JSON ${entryPath}:`, e);
                // Default metadata if parsing fails
                metadata = {
                  ip: '127.0.0.1',
                  version: '1.0.0',
                };
              }
            }
          }

          return {
            id: uniqueId,
            name: entry,
            isFolder: false,
            content,
            nodeType,
            metadata,
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
