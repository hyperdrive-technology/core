import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Activity,
  Box,
  FileText,
  FolderPlus,
  MoreVertical,
  Play,
  Server,
  Trash,
} from 'lucide-react';
import { FileNode } from '../types';

interface NodeActionsProps {
  node: FileNode;
  onAddFile: (parent: FileNode, isFolder: boolean) => void;
  onDeleteFile: (node: FileNode) => void;
  onDeploy?: (node: FileNode) => void;
  onOpenTrends?: (node: FileNode) => void;
  onViewControllerStatus?: (node: FileNode) => void;
  onPreviewControl?: (node: FileNode) => void;
}

export default function NodeActions({
  node,
  onAddFile,
  onDeleteFile,
  onDeploy,
  onOpenTrends,
  onViewControllerStatus,
  onPreviewControl,
}: NodeActionsProps) {
  // --- Debugging ---
  const isControlCandidate = node.name.match(/\.(jsx|tsx)$/);
  console.log(
    `[NodeActions] Node: ${
      node.name
    }, Is Candidate: ${!!isControlCandidate}, Has onPreviewControl Prop: ${!!onPreviewControl}`
  );
  if (isControlCandidate && onPreviewControl) {
    console.log(
      `[NodeActions] Condition MET for showing Preview option for ${node.name}`
    );
  } else if (isControlCandidate) {
    console.log(
      `[NodeActions] Condition FAILED for ${node.name} because onPreviewControl prop is missing/falsy.`
    );
  } else {
    console.log(
      `[NodeActions] Condition FAILED for ${node.name} because it's not a JSX/TSX file.`
    );
  }
  // ---------------

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-6 w-6 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>

        {/* Add file/folder options */}
        {node.isFolder && (
          <>
            <DropdownMenuItem onClick={() => onAddFile(node, false)}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Add File</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddFile(node, true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              <span>Add Folder</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Controller-specific options */}
        {node.nodeType === 'controller' && onDeploy && (
          <>
            <DropdownMenuItem onClick={() => onDeploy(node)}>
              <Play className="mr-2 h-4 w-4" />
              <span>Deploy</span>
            </DropdownMenuItem>
            {onViewControllerStatus && (
              <DropdownMenuItem onClick={() => onViewControllerStatus(node)}>
                <Server className="mr-2 h-4 w-4" />
                <span>View Status</span>
              </DropdownMenuItem>
            )}
            {onOpenTrends && (
              <DropdownMenuItem onClick={() => onOpenTrends(node)}>
                <Activity className="mr-2 h-4 w-4" />
                <span>Open Trends</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Control component preview option */}
        {onPreviewControl && node.name.match(/\.(jsx|tsx)$/) && (
          <>
            <DropdownMenuItem onClick={() => onPreviewControl(node)}>
              <Box className="mr-2 h-4 w-4" />
              <span>Preview Component</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Delete option - available for most nodes */}
        {node.nodeType !== 'heading' && (
          <DropdownMenuItem
            onClick={() => onDeleteFile(node)}
            className="text-red-600"
          >
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
