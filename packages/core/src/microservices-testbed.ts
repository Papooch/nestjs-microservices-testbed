import { ReadPacket } from '@nestjs/microservices';
import { Subject } from 'rxjs';
import { TestBedClient } from './testbed-client';
import { TestBedServer } from './testbed-server';
import { TestBedMessage, TransportId } from './types';

export class MicroservicesTestBed {
    transportId?: TransportId;
    private readonly server: TestBedServer;
    private readonly client: TestBedClient;

    private messagesByPattern = new Map<string, any[]>();
    private requestSubject = new Subject<TestBedMessage>();
    private replySubject = new Subject<TestBedMessage>();

    constructor(options: { transportId?: TransportId } = {}) {
        this.transportId = options.transportId;
        this.server = new TestBedServer({
            transportId: this.transportId,
            requestSubject: this.requestSubject,
            replySubject: this.replySubject,
        });
        this.client = new TestBedClient(
            this.handleMessage.bind(this),
            this.handleEvent.bind(this),
        );
        this.requestSubject.subscribe((message) => {
            const messages = this.messagesByPattern.get(message.pattern) ?? [];
            messages.push(message);
            this.messagesByPattern.set(message.pattern, messages);
        });
        this.replySubject.subscribe((message) => {
            const messages = this.messagesByPattern.get(message.pattern) ?? [];
            messages.push(message);
            this.messagesByPattern.set(message.pattern, messages);
        });
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

    handleMessage<R, T>(message: ReadPacket<T>): Promise<R> {
        const routingKey = Math.random().toString(36).substring(7);
        const replyPromise = new Promise((resolve) => {
            this.replySubject.subscribe((reply) => {
                if (
                    reply.pattern === message.pattern &&
                    reply.routingKey === routingKey
                ) {
                    resolve(reply.data);
                }
            });
        });
        this.requestSubject.next({ ...message, routingKey: routingKey });
        let timeoutKey: NodeJS.Timeout;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutKey = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 1_000);
        });
        return Promise.race([
            replyPromise.then((result) => {
                clearTimeout(timeoutKey);
                return result;
            }),
            timeoutPromise,
        ]) as any;
    }

    handleEvent<T>(message: ReadPacket<T>) {
        return this.requestSubject.next(message);
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
