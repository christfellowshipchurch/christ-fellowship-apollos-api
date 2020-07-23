import gql from 'graphql-tag';

export const groupSchema = gql`
  enum GROUP_TYPE {
    Adult
    CFE
    Freedom
    GetStronger
    HubMarriage
    HubStudies
    MarriageStudies
    Students
    Studies
    TableGetStronger
    TableStudies
    YoungAdults
  }

  type Group implements Node {
    id: ID!
    name: String
    title: String
    groupType: String
    summary: String
    leaders: [Person]
    members: [Person]
    avatars: [String]
    schedule: String
    coverImage: ImageMedia
  }

  extend type Person {
    groups(type: GROUP_TYPE, asLeader: Boolean): [Group]
    isGroupLeader: Boolean
  }
`;

export default groupSchema;
