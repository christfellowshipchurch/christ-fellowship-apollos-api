import { createTestHelpers } from '@apollosproject/server-core/lib/testUtils';
import * as Sms from '../index';

const { getContext } = createTestHelpers({ Sms });
let context;

describe('Twilio Notify', () => {
    beforeEach(() => {
        context = getContext();
    });

    it('constructs with Twilio Notify', () => {
        expect(context.dataSources.Sms).toMatchSnapshot();
    });

    it('sends an sms passing along args', () => {
        const mockCreate = jest.fn();
        context
            .dataSources.Sms
            .twilio.notify
            .services.notifications = mockCreate;

        context.dataSources.Sms.sendSms({
            body: "Here's a cool body",
            to: '5133061126',
            additionalData: 'something else',
        });
        expect(mockCreate.mock.calls).toMatchSnapshot();
    });
});