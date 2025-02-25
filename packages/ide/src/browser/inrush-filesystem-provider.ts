import { Disposable, Emitter, Event } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import {
    FileChange,
    FileChangeType,
    FileSystemProviderCapabilities,
    FileSystemProviderWithFileReadWriteCapability,
    FileType, Stat
} from '@theia/filesystem/lib/common/filesystem';
import { injectable } from 'inversify';

@injectable()
export class InrushFileSystemProvider implements FileSystemProviderWithFileReadWriteCapability {

    private readonly _onDidChangeFile = new Emitter<readonly FileChange[]>();
    readonly onDidChangeFile: Event<readonly FileChange[]> = this._onDidChangeFile.event;

    private projectId: string | undefined;

    constructor() {
        // Listen for messages from the parent window
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'openProject') {
                this.projectId = event.data.projectId;
                console.log('Opening project:', this.projectId);
                // Notify Theia that files have changed
                this._onDidChangeFile.fire([{
                    type: FileChangeType.ADDED,
                    uri: new URI(`inrush:/${this.projectId}`)
                }]);
            }
        });
    }

    capabilities: FileSystemProviderCapabilities =
        FileSystemProviderCapabilities.FileReadWrite |
        FileSystemProviderCapabilities.PathCaseSensitive;

    async stat(resource: URI): Promise<Stat> {
        console.log('stat', resource.toString());

        // Extract path information
        const path = this.getProjectRelativePath(resource);

        // Make API call to get file stats
        const response = await fetch(`/api/fs/stat?projectId=${this.projectId}&path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`Failed to get stats for ${path}`);
        }

        const data = await response.json();

        return {
            type: data.isDirectory ? FileType.Directory : FileType.File,
            mtime: data.mtime,
            ctime: data.ctime,
            size: data.size
        };
    }

    async readFile(resource: URI): Promise<Uint8Array> {
        const path = this.getProjectRelativePath(resource);

        const response = await fetch(`/api/fs/read?projectId=${this.projectId}&path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`Failed to read file ${path}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    async writeFile(resource: URI, content: Uint8Array, opts: { create: boolean, overwrite: boolean }): Promise<void> {
        const path = this.getProjectRelativePath(resource);

        const formData = new FormData();
        formData.append('file', new Blob([content]), path);
        formData.append('projectId', this.projectId || '');
        formData.append('create', opts.create.toString());
        formData.append('overwrite', opts.overwrite.toString());

        const response = await fetch('/api/fs/write', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Failed to write file ${path}`);
        }
    }

    // Helper method to get project-relative path
    private getProjectRelativePath(resource: URI): string {
        // Remove the scheme and project ID prefix
        const fullPath = resource.path.toString();

        if (this.projectId && fullPath.startsWith(`/${this.projectId}/`)) {
            return fullPath.substring(this.projectId.length + 2);
        }

        return fullPath;
    }

    // Implement other required methods...
    async readDirectory(resource: URI): Promise<[string, FileType][]> {
        const path = this.getProjectRelativePath(resource);

        const response = await fetch(`/api/fs/list?projectId=${this.projectId}&path=${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`Failed to read directory ${path}`);
        }

        const data = await response.json();

        return data.items.map((item: any) => [
            item.name,
            item.isDirectory ? FileType.Directory : FileType.File
        ]);
    }

    async createDirectory(resource: URI): Promise<void> {
        const path = this.getProjectRelativePath(resource);

        const response = await fetch('/api/fs/mkdir', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId: this.projectId,
                path
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create directory ${path}`);
        }
    }

    async delete(resource: URI, opts: { recursive: boolean }): Promise<void> {
        const path = this.getProjectRelativePath(resource);

        const response = await fetch('/api/fs/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId: this.projectId,
                path,
                recursive: opts.recursive
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to delete ${path}`);
        }
    }

    async rename(from: URI, to: URI, opts: { overwrite: boolean }): Promise<void> {
        const fromPath = this.getProjectRelativePath(from);
        const toPath = this.getProjectRelativePath(to);

        const response = await fetch('/api/fs/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId: this.projectId,
                fromPath,
                toPath,
                overwrite: opts.overwrite
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to rename ${fromPath} to ${toPath}`);
        }
    }

    watch(resource: URI, opts: { recursive: boolean; excludes: string[] }): Disposable {
        // In a real implementation, you would set up a WebSocket connection to get file change notifications
        return Disposable.NULL;
    }
}
