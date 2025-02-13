import { PLCEditor } from '@inrush/ui/src/components/plc/PLCEditor';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { injectable } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';

@injectable()
export class PLCViewWidget extends ReactWidget {
    static readonly ID = 'plc-view';
    static readonly LABEL = 'PLC View';

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
    }

    protected render(): React.ReactNode {
        return (
            <div className="plc-view-container">
                <PLCEditor
                    initialCode=""
                    onChange={(code: string) => {
                        console.log('Code changed:', code);
                    }}
                />
            </div>
        );
    }
}
