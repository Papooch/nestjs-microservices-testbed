import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Observable } from 'rxjs';

type MessageHandler = (packet: ReadPacket<any>) => Promise<any>;
type EventHandler = (packet: ReadPacket<any>) => void;

export interface TestBedClientOptions {
    messageHandler: MessageHandler;
    eventHandler: EventHandler;
}
export class TestBedClient extends ClientProxy {
    messageHandler: MessageHandler;
    eventHandler: EventHandler;

    constructor(options: TestBedClientOptions) {
        super();
        this.messageHandler = options.messageHandler;
        this.eventHandler = options.eventHandler;
    }

    connect(): Promise<any> {
        return Promise.resolve();
    }
    close() {
        return Promise.resolve();
    }

    send<TResult = any, TInput = any>(
        pattern: any,
        data: TInput,
    ): Observable<TResult> {
        return super.send(pattern, data);
    }

    protected publish(
        packet: ReadPacket<any>,
        callback: (packet: WritePacket<any>) => void,
    ): () => void {
        this.messageHandler(packet).then((result) => {
            callback({
                response: result,
                isDisposed: true,
            });
        });
        return () => {};
    }
    protected async dispatchEvent(packet: ReadPacket<any>): Promise<any> {
        this.eventHandler(packet);
    }
}
