import gql from 'graphql-tag';

export default gql`
  type GroupPreference implements Node {
    id: ID!
    title: String
    summary: String
    coverImage: ImageMedia
    url: String
  }

  extend type Query {
    allPreferences: [GroupPreference]
    allSubPreferences: [GroupPreference]
  }
`;
