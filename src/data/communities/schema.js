import gql from 'graphql-tag';

export default gql`
  type CommunityItem implements Node {
    id: ID!
    title: String
    summary: String
    coverImage: ImageMedia
  }
  extend type Query {
    allCommunities: [CommunityItem]
  }
`;
