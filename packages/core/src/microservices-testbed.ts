import { ReadPacket } from '@nestjs/microservices';
import { Subject } from 'rxjs';
import { TestBedClient } from './testbed-client';
import { TestBedServer } from './testbed-server';
import { TestBedMessage, TransportId } from './types';

export interface MicroservicesTestBedOptions {
    transportId?: TransportId;
    defaultReplyTimeout?: number;
    serverBehavior?: {
        onUnknownPattern?: 'throw' | 'log' | 'ignore';
        onHandlerTypeMismatch?: 'throw' | 'log' | 'ignore';
    };
}
export class MicroservicesTestBed {
    transportId?: TransportId;
    private readonly server: TestBedServer;
    private readonly client: TestBedClient;

    private messagesByPattern = new Map<string, any[]>();
    private requestSubject = new Subject<TestBedMessage>();
    private replySubject = new Subject<TestBedMessage>();

    constructor(private readonly options: MicroservicesTestBedOptions = {}) {
        this.transportId = options.transportId;
        this.server = new TestBedServer(
            {
                transportId: this.transportId,
                requestSubject: this.requestSubject,
                replySubject: this.replySubject,
            },
            options.serverBehavior,
        );
        this.client = new TestBedClient({
            messageHandler: this.handleMessage.bind(this),
            eventHandler: this.handleEvent.bind(this),
        });
        this.requestSubject.subscribe((message) =>
            this.appendMessageToHistory(message),
        );
        this.replySubject.subscribe((message) =>
            this.appendMessageToHistory(message),
        );
    }

    /**
     * Returns an instance of the TestBedServer to be used as a microservice strategy.
     *
     * @example
     * const app = NestFactory.createNestMicroservice<MicroserviceOptions>({
     *   strategy: testBed.getServerInstance(),
     * });
     */
    getServerInstance() {
        return this.server;
    }

    /**
     * Returns a client class that can be used in ClientsModule as an implementation for ClientProxy.
     *
     * @example
     * ClientsModule.register([
     *   {
     *     name: 'MY_CLIENT',
     *     customClass: testBed.getClientClass(),
     *   },
     * ]),
     */
    getClientClass(): typeof TestBedClient {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const testBed = this;
        return class extends TestBedClient {
            // @ts-expect-error return singleton instance
            constructor() {
                return testBed.client;
            }
        };
    }

    /**
     * Sends a message to the server and waits for a response.
     *
     * The message should be handled by a method decorated by `@MessagePattern`.
     */
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
        let timeoutKey: NodeJS.Timeout;
        const timeoutDuration = this.options.defaultReplyTimeout ?? 2_000;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutKey = setTimeout(() => {
                reject(
                    new Error(
                        `Timeout of ${timeoutDuration} ms for handling the message "${message.pattern}" exceeded`,
                    ),
                );
            }, timeoutDuration);
        });
        this.requestSubject.next({ ...message, routingKey: routingKey });
        return Promise.race([replyPromise, timeoutPromise]).finally(() =>
            clearTimeout(timeoutKey),
        ) as Promise<R>;
    }

    /**
     * Sends an event to the server.
     *
     * The message should be handled by a method decorated by `@EventPattern`.
     */
    handleEvent<T>(message: ReadPacket<T>) {
        return this.requestSubject.next(message);
    }

    /**
     * Returns a specified number of most recent messages for a given pattern.
     *
     * The messages are returned in the order they were received.
     */
    getRecentMessagesForPattern<T = any>(
        pattern: string,
        recentMessagesCount = 1,
    ): TestBedMessage<T>[] {
        const messages = this.messagesByPattern.get(pattern);
        const slice = messages?.slice(-recentMessagesCount) ?? [];
        return slice;
    }

    /**
     * Returns a single most recent message for a given pattern.
     *
     * If no message was received, returns an object with empty pattern and undefined data.
     */
    getLastMessageForPattern<T = any>(pattern: string): TestBedMessage<T> {
        const message = this.getRecentMessagesForPattern(pattern, 1).at(0);
        return message ?? { pattern: '', data: undefined };
    }

    /**
     * Clears the message history for all patterns.
     */
    clearMessageHistory() {
        this.messagesByPattern.clear();
    }

    /**
     * Clears the message history for a specified pattern.
     */
    clearMessageHistoryForPattern(pattern: string) {
        this.messagesByPattern.delete(pattern);
    }

    private appendMessageToHistory(message: TestBedMessage) {
        const messages = this.messagesByPattern.get(message.pattern) ?? [];
        messages.push(message);
        this.messagesByPattern.set(message.pattern, messages);
    }
}
