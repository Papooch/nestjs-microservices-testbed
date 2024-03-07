import { ClientProviderOptions, ReadPacket } from '@nestjs/microservices';
import { TestBedClient } from './testbed-client';
import { TestBedServer } from './testbed-server';
import { TransportId } from './types';

export class MicroservicesTestBed {
    transportId?: TransportId;
    private readonly server: TestBedServer;
    private readonly client: TestBedClient;

    constructor(options: { transportId?: TransportId } = {}) {
        this.transportId = options.transportId;
        this.server = new TestBedServer({ transportId: this.transportId });
        this.client = new TestBedClient(this.handleMessage.bind(this));
    }

    getServerInstance() {
        return this.server;
    }

    getClientInstance(): TestBedClient {
        return this.client;
    }

    getClientClass(): typeof TestBedClient {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const testBed = this;
        return class extends TestBedClient {
            // @ts-expect-error return singleton instance
            constructor() {
                return testBed.getClientInstance();
            }
        };
    }

    getClientProviderOptions(
        injectionToken: string | symbol,
    ): ClientProviderOptions {
        return {
            name: injectionToken,
            customClass: this.getClientClass(),
        };
    }

    handleMessage<T>(message: ReadPacket<T>) {
        return this.server.emitMessage(message.pattern, message.data);
    }
}
