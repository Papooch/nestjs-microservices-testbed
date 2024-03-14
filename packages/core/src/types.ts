import { Transport } from '@nestjs/microservices';

export type TransportId = symbol | Transport | undefined;

export type TestBedMessage<T = any> = {
    pattern: string;
    routingKey?: string;
    data: T;
};
