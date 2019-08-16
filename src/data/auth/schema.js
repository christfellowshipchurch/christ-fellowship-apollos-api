import { gql } from 'apollo-server'
import { authSchema } from '@apollosproject/data-schema'

export default gql`
    ${authSchema}

    type IdentityResult {
        success: Boolean
        isExistingIdentity: Boolean
    }

    type UserLoginResult {
        sms: Boolean
        email: Boolean
    }
    
    extend type Mutation {
        requestSmsLoginPin(phoneNumber: String!): IdentityResult
        authenticateCredentials(identity: String!, passcode: String!): Authentication
        createNewUserLogin(identity: String!, passcode: String!): Authentication
        relateUserLoginToPerson(identity: String!, passcode: String!, input:[UpdateProfileInput]!): Authentication
        isValidIdentity(identity: String): IdentityResult
    }

    extend type Query {
        getUserLoginTypes: UserLoginResult
    }
`