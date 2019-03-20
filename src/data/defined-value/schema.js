import { gql } from 'apollo-server';

export default gql`
    extend type Query {
        getDefinedValueByIdentifier(identifier: String): DefinedValue
    }
    type DefinedValue implements Node {
        id: ID!
        value: String
    }
`;