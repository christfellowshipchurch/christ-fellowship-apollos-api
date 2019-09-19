import { gql } from 'apollo-server'

export default gql`
    input Attribute {
        field: String!
        value: String!
    }
`