import {
    CallHandler,
    Controller,
    ExecutionContext,
    INestMicroservice,
    Inject,
    Logger,
    Module,
    NestInterceptor,
    UseInterceptors,
} from '@nestjs/common';
import {
    ClientProxy,
    ClientsModule,
    EventPattern,
    MessagePattern,
    MicroserviceOptions,
    Payload,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { Observable, firstValueFrom, map } from 'rxjs';
import { MicroservicesTestBed } from '../src';
import { TestBedClient } from '../src/testbed-client';

const testBed = new MicroservicesTestBed();

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

@Controller()
class TestAppConsumer {
    private readonly logger = new Logger(TestAppConsumer.name);

    constructor(
        @Inject('TEST_SERVICE')
        private readonly client: ClientProxy,
    ) {}

    @MessagePattern('hello-world')
    @UseInterceptors(ExclamationInterceptor)
    async helloWorld(@Payload() data: string) {
        return firstValueFrom(this.client.send('respond', data));
    }

    @MessagePattern('respond')
    respond(@Payload() data: string) {
        return `Response for ${data}`;
    }

    @EventPattern('hello-event')
    helloEvent() {
        return 'Hello Event!';
    }
}

const clientsModule = ClientsModule.register([
    {
        name: 'TEST_SERVICE',
        customClass: TestBedClient,
    },
]);

@Module({
    imports: [clientsModule],
    controllers: [TestAppConsumer],
})
class TestAppModule {}

describe('Microservices Testbed', () => {
    let app: INestMicroservice;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [TestAppModule],
        })
            .overrideModule(clientsModule)
            .useModule({
                module: class TestModule {},
                imports: [
                    ClientsModule.register([
                        testBed.getClientProviderOptions('TEST_SERVICE'),
                    ]),
                ],
                exports: [ClientsModule],
            })
            .compile();
        app = module.createNestMicroservice<MicroserviceOptions>({
            strategy: testBed.getServerInstance(),
        });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should handle message pattern', async () => {
        const result = await testBed.handleMessage({
            pattern: 'hello-world',
            data: 'World',
        });
        expect(result).toBe('Response for World!');
    });
});
