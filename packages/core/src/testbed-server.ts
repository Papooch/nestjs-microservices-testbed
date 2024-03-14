import { TestBedMessage, TransportId } from './types';

import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import { Subject, isObservable, lastValueFrom } from 'rxjs';

export class TestBedServer extends Server implements CustomTransportStrategy {
    transportId?: TransportId;
    requestSubject: Subject<TestBedMessage>;
    replySubject: Subject<TestBedMessage>;

    constructor(options: {
        transportId?: TransportId;
        requestSubject: Subject<TestBedMessage>;
        replySubject: Subject<TestBedMessage>;
    }) {
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
            return this.logger.error(
                `No handler for pattern ${message.pattern}`,
            );
        }
        if (message.routingKey && handler.isEventHandler) {
            throw new Error(
                `The handler for pattern ${message.pattern} is an event handler but the message expects a response. Did you mean to use @MessagePattern or use client.emit at the publishing side?`,
            );
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
