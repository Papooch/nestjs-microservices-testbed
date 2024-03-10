import { TransportId } from './types';

import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import { isObservable, lastValueFrom } from 'rxjs';

export class TestBedServer extends Server implements CustomTransportStrategy {
    transportId?: TransportId;

    constructor(options: { transportId?: TransportId } = {}) {
        super();
        this.transportId = options.transportId;
    }

    listen(callback: (...optionalParams: unknown[]) => any) {
        callback();
    }
    close() {}

    public async handleEventOrMessage(
        pattern: string,
        data: any,
    ): Promise<any> {
        const handler = this.getHandlerByPattern(pattern);
        if (!handler) {
            return this.logger.error(`No handler for pattern ${pattern}`);
        }
        const resultOrStream = await handler(data, {});
        let result: any;
        if (isObservable(resultOrStream)) {
            result = lastValueFrom(resultOrStream);
        } else {
            result = resultOrStream;
        }
        if (handler.isEventHandler) {
            return;
        }
        return result;
    }
}
