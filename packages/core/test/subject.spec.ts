import { Subject } from 'rxjs';

describe('subject', () => {
    it('works', async () => {
        const subject = new Subject();

        subject.asObservable().forEach((value) => {
            console.log('i got this: ' + value);
        });
        subject.subscribe((value) => {
            console.log(value);
        });
        subject.next('Hello');
        subject.next('World');
    });
});
