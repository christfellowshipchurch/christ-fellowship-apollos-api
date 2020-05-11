import { gql } from 'apollo-server'
import { authSchema } from '@apollosproject/data-schema';

export default gql`
    ${authSchema}

    extend type Mutation {
        requestEmailLoginPin: Boolean
        changePasswordWithPin(email: String!, pin: String!, newPassword: String!): Authentication
    }
`