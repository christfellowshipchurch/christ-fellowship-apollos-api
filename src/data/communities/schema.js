import gql from 'graphql-tag';

export default gql`
  type LineupItem implements Node {
    id: ID!
    coverImage: ImageMedia
    title: String
  }

  type CommunityItem implements Node {
    id: ID!
    coverImage: ImageMedia
    lineups: [LineupItem]
    summary: String
    title: String
    type: String
  }
  extend type Query {
    allCommunities: [CommunityItem]
  }
`;
