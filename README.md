# NestJS Microservices TestBed

Do yo find it hard to implement integration (e2e) tests for your NestJS microservices without having to run the real broker?

This project aims to provide a similar testing experience to testing a NestJS HTTP server without having to spin it up.

The library provides a `MicroserviceTestBed` class that acts as a "broker" and exposes a custom microservice _Transporter_ which plugs into the NestJS microservice abstraction.

This way, you can "emit" messages to the test bed and your application would handle them as if they were coming from a real broker. This way you can easily test

> ### ⚠️ Warning 🏗 Under construction 🚧
>
> This library is still in a very early stage of development and does not yet support all the features of the NestJs microservices abstraction, namely, there is no support for the `@Context` decorator yet nor for any platform-specific features of other transporters.

## Example

<!-- prettier-ignore -->
```ts
// ...other imports
import { TestBedClient } from '@nestjs-microservices-testbed/core';
import waitForExpect from 'wait-for-expect';

class ExclamationInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any> ): Observable<any> {
        return next.handle()
            .pipe(map((result) => result + '!'));
    }
}

@Controller()
class TestAppConsumer {

    constructor(
        @Inject('TEST_CLIENT')
        private readonly client: ClientProxy,
    ) {}

    @MessagePattern('say-hello')
    @UseInterceptors(ExclamationInterceptor)
    async helloWorld(@Payload() data: string) {
        return `Hello ${data}`;
    }

    returnResponse() {
        return firstValueFrom(this.client.send('handle-response', ''));
    }

    @MessagePattern('handle-response')
    handleResponse() {
        return 'Response!';
    }

    @EventPattern('events')
    handleEvent(@Payload() data: string) {
        this.client.emit('emitted-events', data).subscribe();
    }
}


describe('Microservices Testbed', () => {

    // create instance of the test bed
    const testBed = new MicroservicesTestBed();
    let app: INestMicroservice;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [
                ClientsModule.register([{
                    name: 'TEST_SERVICE',
                    // register a custom class to be used as the client
                    customClass: testBed.getClientClass(),
                }]);
            ]
            controllers: [TestAppConsumer],
        })
        app = module.createNestMicroservice<MicroserviceOptions>({
            // retrieve the test bed server instance
            strategy: testBed.getServerInstance(),
        });
        await app.init();
    });

    afterAll(() => app.close());

    it('should handle message pattern', async () => {
        // send a message using the test bed
        const result = await testBed.handleMessage({
            pattern: 'hello-world',
            data: 'World',
        });
        // observe that your application handled the message
        // and the interceptor was triggered
        expect(result).toBe('Hello World!');
    });

    it('should handle client response', async () => {
        // invoke a method that sends a message using the client
        const result = await app.get(TestAppConsumer).returnResponse();
        // observe that a response was received through the client
        expect(result).toBe('Response!');
    });

    it('should handle event pattern', async () => {
        // emit an event using the test bed
        testBed.handleEvent({
            pattern: 'events',
            data: 'event-payload',
        });
        await waitForExpect(() => {
            // verify that your application handled the event
            // by checking that it emitted another event
            expect(
                testBed.getLastMessageForPattern('emitted-events').data
            ).toEqual(['event-payload']);
        });
    });
});
```
