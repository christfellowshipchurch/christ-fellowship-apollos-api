import { DataSource } from 'apollo-datasource';
import ApollosConfig from '@apollosproject/config';
import Twilio from 'twilio';

const { TWILIO } = ApollosConfig;

export default class TwilioNotify extends DataSource {
    constructor(...args) {
        super(...args);
        console.log(TWILIO.ACCOUNT_SID);
        this.twilio = new Twilio(TWILIO.ACCOUNT_SID, TWILIO.AUTH_TOKEN);
    }

    sendSms({ body, to, from = TWILIO.FROM_NUMBER, ...args }) {
        return this.twilio.notify
            .services(TWILIO.NOTIFY_SID)
            .notifications.create({
                toBinding: JSON.stringify({
                    binding_type: 'sms',
                    address: to
                }),
                body,
                from,
                ...args,
            });
    }
}