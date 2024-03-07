import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export class TestBedClient extends ClientProxy {
    constructor(
        private readonly messageHandler: (
            packet: ReadPacket<any>,
        ) => Promise<any>,
    ) {
        super();
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
            });
        });
        return () => {};
    }
    protected async dispatchEvent<T = any>(
        packet: ReadPacket<any>,
    ): Promise<T> {
        return await this.messageHandler(packet);
    }
}
