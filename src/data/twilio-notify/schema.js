import gql from 'graphql-tag'

export default gql`
    input TwilioNotifyPushInput {
        enabled: Boolean
        bindingType: String
        address: String
    }

    extend type Mutation {
        updateUserPushSettingsTN(input: TwilioNotifyPushInput!): Person
    }
`