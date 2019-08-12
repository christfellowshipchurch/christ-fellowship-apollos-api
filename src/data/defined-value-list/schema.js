import { gql } from 'apollo-server'

export default gql`
    extend type Query {
        getDefinedValueListByIdentifier(identifier: String): DefinedValueList
    }
    type DefinedValueList implements Node {
        id: ID!
        values: [DefinedValue]
    }
`;