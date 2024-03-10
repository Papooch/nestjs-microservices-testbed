import {
    CallHandler,
    Controller,
    ExecutionContext,
    INestMicroservice,
    Injectable,
    Logger,
    Module,
    NestInterceptor,
    UseInterceptors,
} from '@nestjs/common';
import {
    EventPattern,
    MessagePattern,
    MicroserviceOptions,
    Payload,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { Observable, map } from 'rxjs';
import waitForExpect from 'wait-for-expect';
import { MicroservicesTestBed } from '../src';

const testBed = new MicroservicesTestBed();

class AssertionHelper {
    public readonly handledEvents: string[] = [];
    public readonly interceptedEvents: string[] = [];
}

@Injectable()
class ExclamationInterceptor implements NestInterceptor {
    constructor(private readonly assertionHelper: AssertionHelper) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler<any>,
    ): Observable<any> {
        this.assertionHelper.interceptedEvents.push(
            `intercepted:${context.switchToRpc().getData()}`,
        );
        return next.handle().pipe(
            map((result) => {
                return result + '!';
            }),
        );
    }
}

@Controller()
class TestAppConsumer {
    private readonly logger = new Logger(TestAppConsumer.name);

    constructor(private readonly assertionHelper: AssertionHelper) {}

    @EventPattern('plain-event')
    async plainEvent(@Payload() data: string) {
        this.assertionHelper.handledEvents.push(`handled:${data}`);
    }

    @MessagePattern('plain-message')
    async respond(@Payload() data: string) {
        return `response:${data}`;
    }

    @EventPattern('event-with-interceptor')
    @UseInterceptors(ExclamationInterceptor)
    async eventWithInterceptor(@Payload() data: string) {
        this.assertionHelper.handledEvents.push(`handled:${data}`);
    }

    @MessagePattern('message-with-interceptor')
    @UseInterceptors(ExclamationInterceptor)
    async messageWithInterceptor(@Payload() data: string) {
        return `response:${data}`;
    }
}

@Module({
    controllers: [TestAppConsumer],
    providers: [AssertionHelper],
})
class TestAppModule {}

describe('Microservices Testbed', () => {
    let app: INestMicroservice;
    let assertionHelper: AssertionHelper;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [TestAppModule],
        }).compile();
        app = module.createNestMicroservice<MicroserviceOptions>({
            strategy: testBed.getServerInstance(),
        });
        assertionHelper = app.get(AssertionHelper);
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('handles plain event pattern', async () => {
        await testBed.handleMessage({
            pattern: 'plain-event',
            data: 'something',
        });
        await waitForExpect(() => {
            expect(assertionHelper.handledEvents.at(-1)).toBe(
                'handled:something',
            );
        });
    });

    it('responds to plain message pattern', async () => {
        const response = await testBed.handleMessage({
            pattern: 'plain-message',
            data: 'payload',
        });
        expect(response).toBe('response:payload');
    });

    it('handles event pattern interceptor', async () => {
        await testBed.handleMessage({
            pattern: 'event-with-interceptor',
            data: 'intercepted-event',
        });
        expect(assertionHelper.interceptedEvents.at(-1)).toBe(
            'intercepted:intercepted-event',
        );
        await waitForExpect(() => {
            expect(assertionHelper.handledEvents.at(-1)).toBe(
                'handled:intercepted-event',
            );
        });
    });

    it('responds to message pattern interceptor', async () => {
        const response = await testBed.handleMessage({
            pattern: 'message-with-interceptor',
            data: 'intercepted-message',
        });
        expect(response).toBe('response:intercepted-message!');
    });
});
