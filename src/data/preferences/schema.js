import gql from 'graphql-tag';

export default gql`
  type SubPreference implements Node {
    id: ID!
    title: String
    coverImage: ImageMedia
  }

  type Preference implements Node {
    id: ID!
    title: String
    summary: String
    coverImage: ImageMedia
  }

  extend type Query {
    allPreferences: [Preference]
    allSubPreferences: [SubPreference]
  }
`;
