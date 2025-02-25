import { FileSystemProvider, FileSystemProviderRegistry } from '@theia/filesystem/lib/common/filesystem';
import { ContainerModule } from 'inversify';
import { InrushFileSystemProvider } from './inrush-filesystem-provider';

export default new ContainerModule(bind => {
    // Bind our filesystem provider
    bind(InrushFileSystemProvider).toSelf().inSingletonScope();

    // Register the provider for our custom URI scheme
    bind(FileSystemProvider).toDynamicValue(ctx => {
        const provider = ctx.container.get(InrushFileSystemProvider);
        return {
            scheme: 'inrush',
            provider
        };
    }).inSingletonScope();

    // Make sure our provider is registered with the registry
    bind(FileSystemProviderRegistry).toDynamicValue(ctx => {
        const registry = ctx.container.get(FileSystemProviderRegistry);
        const contribution = ctx.container.get<{ scheme: string, provider: FileSystemProvider }>(FileSystemProvider);

        registry.registerProvider(contribution.scheme, contribution.provider);

        return registry;
    }).inSingletonScope();
});
