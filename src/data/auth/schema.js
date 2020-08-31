import { gql } from 'apollo-server'
import { authSchema } from '@apollosproject/data-schema';

export default gql`
    ${authSchema}

    extend type Mutation {
        requestEmailLoginPin(email: String!): Boolean
        changePasswordWithPin(email: String!, pin: String!, newPassword: String!): Authentication
    }

    extend type Query {
        canAccessExperimentalFeatures: Boolean
    }

    extend type AuthenticatedUser {
        streamChatToken: String
    }
`