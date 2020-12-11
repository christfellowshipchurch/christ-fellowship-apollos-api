import { searchSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';

export default gql`
  extend type Mutation {
    flushRock(entityId: Int!, entityTypeId: Int!, key: String!): String
  }
`;
