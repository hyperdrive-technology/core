import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { injectable } from '@theia/core/shared/inversify';
import { PLCViewWidget } from './plc-view-widget';

@injectable()
export class PLCFrontendContribution implements FrontendApplicationContribution {
    constructor(
        protected readonly widgetManager: WidgetManager
    ) { }

    async onStart(): Promise<void> {
        // Open PLC view by default
        const widget = await this.widgetManager.getOrCreateWidget(PLCViewWidget.ID);
        await widget.activate();
    }
}
