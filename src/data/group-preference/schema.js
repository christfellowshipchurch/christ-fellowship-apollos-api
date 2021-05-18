import gql from 'graphql-tag';

export default gql`
  type GroupPreference implements Node {
    id: ID!
    title: String
    summary: String
    coverImage(nodeId: ID): ImageMedia
    url: String
  }

  extend type Query {
    allPreferences: [GroupPreference]
    allSubPreferences: [GroupPreference]
    groupSubPreferences(preferenceId: ID): [GroupPreference]
  }
`;
