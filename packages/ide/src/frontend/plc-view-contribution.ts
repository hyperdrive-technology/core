import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { injectable } from '@theia/core/shared/inversify';
import { PLCViewWidget } from './plc-view-widget';

export const PLCCommands = {
    togglePLCView: {
        id: 'plc-view:toggle',
        label: 'Toggle PLC View'
    }
};

@injectable()
export class PLCViewContribution extends AbstractViewContribution<PLCViewWidget> implements TabBarToolbarContribution {
    constructor() {
        super({
            widgetId: PLCViewWidget.ID,
            widgetName: PLCViewWidget.LABEL,
            defaultWidgetOptions: { area: 'main' },
            toggleCommandId: PLCCommands.togglePLCView.id
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(PLCCommands.togglePLCView, {
            execute: () => this.toggleView()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
    }

    async registerToolbarItems(toolbar: TabBarToolbarRegistry): Promise<void> {
        // Add toolbar items if needed
    }
}
