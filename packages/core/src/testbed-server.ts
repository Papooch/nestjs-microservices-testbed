import { TestBedMessage, TransportId } from './types';

import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import { Subject, isObservable, lastValueFrom } from 'rxjs';

export interface TestBedServerOptions {
    transportId?: TransportId;
    requestSubject: Subject<TestBedMessage>;
    replySubject: Subject<TestBedMessage>;
}

export interface TestBedServerBehaviorOptions {
    onUnknownPattern?: 'throw' | 'log' | 'ignore';
    onHandlerTypeMismatch?: 'throw' | 'log' | 'ignore';
}

export class TestBedServer extends Server implements CustomTransportStrategy {
    transportId?: TransportId;
    requestSubject: Subject<TestBedMessage>;
    replySubject: Subject<TestBedMessage>;

    constructor(
        options: TestBedServerOptions,
        private readonly behaviorOptions: TestBedServerBehaviorOptions = {},
    ) {
        super();
        this.transportId = options.transportId;
        this.requestSubject = options.requestSubject;
        this.replySubject = options.replySubject;
    }

    listen(callback: (...optionalParams: unknown[]) => any) {
        this.requestSubject.subscribe((message) => {
            this.handleEventOrMessage(message);
        });
        callback();
    }
    close() {
        this.requestSubject.complete();
        this.replySubject.complete();
    }

    private async handleEventOrMessage(message: TestBedMessage): Promise<any> {
        const handler = this.getHandlerByPattern(message.pattern);
        if (!handler) {
            const errorMessage = `No handler exists for pattern ${message.pattern}`;
            if (this.behaviorOptions.onUnknownPattern === 'throw') {
                throw new Error(errorMessage);
            } else if (this.behaviorOptions.onUnknownPattern === 'log') {
                return this.logger.error(errorMessage);
            }
            return;
        }
        if (handler.isEventHandler && message.routingKey) {
            const errorMessage = `The handler for pattern ${message.pattern} is an event handler but the message has a routing key. Did you mean to use @MessagePattern or use client.emit at the publishing side?`;
            if (this.behaviorOptions.onHandlerTypeMismatch === 'throw') {
                throw new Error(errorMessage);
            } else if (this.behaviorOptions.onHandlerTypeMismatch === 'log') {
                return this.logger.error(errorMessage);
            }
        }

        const resultOrStream = await handler(message.data, {});
        let result: any;
        if (isObservable(resultOrStream)) {
            result = await lastValueFrom(resultOrStream);
        } else {
            result = resultOrStream;
        }
        if (handler.isEventHandler) {
            return;
        }
        return this.replySubject.next({
            pattern: message.pattern,
            data: result,
            routingKey: message.routingKey,
        });
    }
}
