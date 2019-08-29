import { RESTDataSource } from 'apollo-datasource-rest';
import ApollosConfig from '@apollosproject/config';
import Twilio from 'twilio';

const { TWILIO } = ApollosConfig;
const { ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER, NOTIFY_SID } = TWILIO

export default class TwilioNotify extends RESTDataSource {

    // Creates a new instance of the Twilio object using Account SID and an Auth Token
    constructor(...args) {
        super(...args);
        this.twilio = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
    }

    // Sends an SMS to a phone number using Twilio Notify
    sendSms({ body, to, from = FROM_NUMBER, ...args }) {
        return this.twilio.notify
            .services(NOTIFY_SID)
            .notifications.create({
                toBinding: JSON.stringify({
                    binding_type: 'sms',
                    address: to,
                }),
                body,
                from,
                ...args,
            });
    }

    async updatePushSettings({ enabled, bindingType, address }) {
        console.log("Updating Push Settings", { enabled, bindingType, address })

        // Gets current person from Auth
        const currentUser = await this.context.dataSources.Auth.getCurrentPerson();

        // If not enabled
        if (!enabled) {
            // update the person's record to reflect that they have opted out of PN
        }

        // If enabled is true and currentUser is found
        if (enabled && currentUser) {
            // get the current person's PersonAliasId
            const { primaryAliasId } = currentUser

            // create a binding with Twilio Notify using PersonAliasId as the Identifier and the device id for the device being registered
            this.twilio.notify
                .services(NOTIFY_SID)
                .bindings.create({
                    identity: primaryAliasId,
                    bindingType,
                    address
                })
                .catch(async e => {
                    console.log({ e })
                })

        }
        return currentUser
    }
}