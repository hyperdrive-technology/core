import { FileNode } from './types';

/**
 * Finds a file node by its ID in the file tree
 */
export function findFileById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    if (node.children) {
      const childResult = findFileById(node.children, id);
      if (childResult) {
        return childResult;
      }
    }
  }

  return null;
}

/**
 * Finds the first file in the file tree (useful for initial file selection)
 */
export function findFirstFile(nodes: FileNode[]): FileNode | null {
  for (const node of nodes) {
    if (!node.isFolder) {
      return node;
    }

    if (node.children) {
      const childResult = findFirstFile(node.children);
      if (childResult) {
        return childResult;
      }
    }
  }

  return null;
}

/**
 * Updates the content of a file in the file tree
 */
export function updateFileContent(
  nodes: FileNode[],
  fileId: string,
  newContent: string,
): FileNode[] {
  return nodes.map((node) => {
    if (node.id === fileId) {
      return { ...node, content: newContent };
    }

    if (node.children) {
      return {
        ...node,
        children: updateFileContent(node.children, fileId, newContent),
      };
    }

    return node;
  });
}

/**
 * Generates a unique ID for a new file
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Removes a node from the file tree
 */
export function removeNode(nodes: FileNode[], nodeId: string): FileNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.children) {
        return {
          ...node,
          children: removeNode(node.children, nodeId),
        };
      }
      return node;
    });
}
