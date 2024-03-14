import {
    CallHandler,
    Controller,
    ExecutionContext,
    INestMicroservice,
    Inject,
    Injectable,
    Module,
    NestInterceptor,
    UseInterceptors,
} from '@nestjs/common';
import {
    ClientProxy,
    ClientsModule,
    MessagePattern,
    MicroserviceOptions,
    Payload,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { Observable, lastValueFrom, map } from 'rxjs';
import waitForExpect from 'wait-for-expect';
import { MicroservicesTestBed } from '../src';

const testBed = new MicroservicesTestBed();

@Injectable()
class ExclamationInterceptor implements NestInterceptor {
    intercept(
        context: ExecutionContext,
        next: CallHandler<any>,
    ): Observable<any> {
        return next.handle().pipe(
            map((result) => {
                return result + '!';
            }),
        );
    }
}

@Injectable()
class TestAppProducer {
    constructor(@Inject('TEST_CLIENT') private readonly client: ClientProxy) {}

    async emitEvent(data: string) {
        await lastValueFrom(
            this.client.emit('emitted-events', `emitted:${data}`),
        );
    }

    async sendMessage(data: string) {
        const result = await lastValueFrom(
            this.client.send('sent-messages', `sent:${data}`),
        );
        return result;
    }

    async sendMessageWithInterceptor(data: string) {
        const result = await lastValueFrom(
            this.client.send('sent-messages-with-interceptor', `sent:${data}`),
        );
        return result;
    }
}

@Controller()
class TestAppConsumer {
    @MessagePattern('sent-messages')
    async respond(@Payload() data: string) {
        return `response:${data}`;
    }

    @MessagePattern('sent-messages-with-interceptor')
    @UseInterceptors(ExclamationInterceptor)
    async respondWithInterceptor(@Payload() data: string) {
        return `response:${data}`;
    }
}

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'TEST_CLIENT',
                customClass: testBed.getClientClass(),
            },
        ]),
    ],
    controllers: [TestAppConsumer],
    providers: [TestAppProducer],
})
class TestAppModule {}

describe('Microservices Testbed', () => {
    let app: INestMicroservice;
    let producer: TestAppProducer;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [TestAppModule],
        }).compile();
        app = module.createNestMicroservice<MicroserviceOptions>({
            strategy: testBed.getServerInstance(),
        });
        producer = app.get(TestAppProducer);
        await app.listen();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should assert emitted message', async () => {
        await producer.emitEvent('emitted-event');
        await waitForExpect(() => {
            expect(
                testBed.getLastMessageForPattern('emitted-events').data,
            ).toBe('emitted:emitted-event');
        });
    });

    it('should handle request-response', async () => {
        const response = await producer.sendMessage('sent-message');
        expect(response).toBe('response:sent:sent-message');
    });

    it('should handle request-response with interceptor', async () => {
        const response = await producer.sendMessageWithInterceptor(
            'sent-message-with-interceptor',
        );
        expect(response).toBe('response:sent:sent-message-with-interceptor!');
    });
});
