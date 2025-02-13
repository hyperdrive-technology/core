import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { WebSocketChannel } from '@theia/core/lib/node/messaging';
import { injectable } from '@theia/core/shared/inversify';
import { TheiaServer } from './theia-server';

@injectable()
export class PLCBackendContribution implements BackendApplicationContribution {
    private theiaServer: TheiaServer;

    constructor() {
        this.theiaServer = new TheiaServer();
    }

    initialize() {
        this.theiaServer.start();
    }

    onStop() {
        if (this.theiaServer) {
            this.theiaServer.stop();
        }
    }

    configure(app: any) {
        const wss = new WebSocketChannel();

        wss.onConnection(ws => {
            console.log('New WebSocket connection');

            ws.on('message', async (data: string) => {
                try {
                    const message = JSON.parse(data);
                    // Forward messages to the Theia server
                    this.theiaServer.handleMessage(ws, message);
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
