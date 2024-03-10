import { ReadPacket } from '@nestjs/microservices';
import { TestBedClient } from './testbed-client';
import { TestBedServer } from './testbed-server';
import { TransportId } from './types';

export class MicroservicesTestBed {
    transportId?: TransportId;
    private readonly server: TestBedServer;
    private readonly client: TestBedClient;

    private messagesByPattern = new Map<string, any[]>();

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

    handleMessage<T>(message: ReadPacket<T>) {
        const messages = this.messagesByPattern.get(message.pattern) ?? [];
        messages.push(message);
        this.messagesByPattern.set(message.pattern, messages);
        return this.server.handleEventOrMessage(message.pattern, message.data);
    }

    getRecentMessagesForPattern<T = any>(
        pattern: string,
        recentMessagesCount = 1,
    ): T[] {
        const messages = this.messagesByPattern.get(pattern);
        const slice = messages?.slice(-recentMessagesCount) ?? [];
        return slice;
    }

    getLastMessageForPattern(pattern: string) {
        const message = this.getRecentMessagesForPattern(pattern, 1).at(0);
        return message;
    }
}
