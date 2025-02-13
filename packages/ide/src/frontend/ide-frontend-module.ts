import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { ContainerModule } from '@theia/core/shared/inversify';
import { PLCFrontendContribution } from './plc-frontend-contribution';
import { PLCViewContribution } from './plc-view-contribution';
import { PLCViewWidget } from './plc-view-widget';

export default new ContainerModule(bind => {
    bind(FrontendApplicationContribution).to(PLCFrontendContribution).inSingletonScope();
    bind(PLCViewContribution).toSelf().inSingletonScope();
    bind(PLCViewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: PLCViewWidget.ID,
        createWidget: () => ctx.container.get<PLCViewWidget>(PLCViewWidget)
    })).inSingletonScope();
});
