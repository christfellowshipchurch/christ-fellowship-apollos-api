import gql from 'graphql-tag';

export const groupSchema = gql`
  enum GROUP_TYPE {
    Serving
    Community
    Family
    Adult
    Freedom
  }

  type Group implements Node {
    id: ID!
    name: String
    title: String
    groupType: String
    summary: String
    leaders: [Person]
    members: [Person]
    schedule: String
  }

  extend type Person {
    groups(type: GROUP_TYPE, asLeader: Boolean): [Group]
    isGroupLeader: Boolean
  }
`;

export default groupSchema;
