import { gql } from 'apollo-server'
import { authSchema } from '@apollosproject/data-schema'

export default gql`
    ${authSchema}

    type SmsPinResult {
        success: Boolean
        createdDateTime: String
    }
    
    extend type Mutation {
        requestSmsLoginPin(phoneNumber: String!): SmsPinResult
        authenticateCredentials(identity: String!, passcode: String!): Authentication
        updateUserLogin(identity: String!, passcode: String!): SmsPinResult
        relateUserLoginToPerson(identity: String!, passcode: String!, input:[UpdateProfileInput]!): SmsPinResult
    }
`