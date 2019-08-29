import gql from 'graphql-tag'

export default gql`
    input TwilioNotifyPushInput {
        enabled: Boolean
        bindingType: String
        address: String
    }

    input PushMessageInput {
        title: String
        body: String
        identity: String
    }

    extend type Mutation {
        updateUserPushSettingsTN(input: TwilioNotifyPushInput!): Person
        sendPushNotification(input: PushMessageInput): Boolean
    }
`