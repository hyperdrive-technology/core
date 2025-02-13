import { PLCClient } from '@inrush/ui/src/lib/plc-client';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { WebSocketChannel } from '@theia/core/lib/node/messaging';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class PLCBackendContribution implements BackendApplicationContribution {
    private plcClient: PLCClient;

    initialize() {
        this.plcClient = new PLCClient();
        this.plcClient.connect();
    }

    onStop() {
        if (this.plcClient) {
            this.plcClient.disconnect();
        }
    }

    configure(app: any) {
        const wss = new WebSocketChannel();

        wss.onConnection(ws => {
            console.log('New WebSocket connection');

            ws.on('message', async (data: string) => {
                try {
                    const message = JSON.parse(data);
                    switch (message.type) {
                        case 'subscribe':
                            // Handle tag subscription
                            break;
                        case 'unsubscribe':
                            // Handle tag unsubscription
                            break;
                        case 'write':
                            // Handle tag write
                            break;
                    }
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
            });
        });
    }
}
