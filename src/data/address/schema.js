import { gql } from 'apollo-server'

export default gql`

    type Address implements Node {
        id: ID!
        street1: String!
        street2: String
        city: String!
        state: String!
        postalCode: String!
    }

    extend type Query {
        getAddressByPerson: Address
        getStatesList: DefinedValueList
            @deprecated(reason: "Use 'statesList' instead.")
        stateOptions: [String]
    }
`