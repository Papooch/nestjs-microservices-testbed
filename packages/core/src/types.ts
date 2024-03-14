import { Transport } from '@nestjs/microservices';

export type TransportId = symbol | Transport | undefined;

export type TestBedMessage = {
    pattern: string;
    routingKey?: string;
    data: any;
};
