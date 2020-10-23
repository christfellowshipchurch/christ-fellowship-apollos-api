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

    DreamTeam
  }

  type Resource {
    title: String
    url: String
    contentChannelItem: String
    
    icon: String
    action: ACTION_FEATURE_ACTION
    relatedNode: Node
  }

  type DateTime {
    start: String
    end: String
  }

  type Schedule {
    id: ID!
    name: String
    description: String
    friendlyScheduleText: String
    weeklyTimeOfDay: String
    weeklyDayOfWeek: Int
    iCalendarContent: String
    isActive: Boolean
  }

  type VideoCallParams {
    link: String
    meetingId: String
    passcode: String
    labelText: String
  }

  interface GroupItem {
    title: String
    summary: String
    groupType: String
    groupResources: [Resource]
    coverImage: ImageMedia

    people(
      first: Int
      after: String
      isLeader: Boolean
    ): PeopleConnection
    chatChannelId: String
  }

  type Group implements GroupItem & Node {
    id: ID!

    title: String
    summary: String
    groupType: String
    coverImage: ImageMedia
    groupResources: [Resource]

    people(
      first: Int
      after: String
      isLeader: Boolean
    ): PeopleConnection

    chatChannelId: String

    allowMessages: String
    dateTime: DateTime
    parentVideoCall: VideoCallParams
    phoneNumbers: [String]
    schedule: Schedule
    videoCall: VideoCallParams

    avatars: [String] @deprecated(reason: "Use people instead")
    leaders: [Person] @deprecated(reason: "Use people instead")
    members: [Person] @deprecated(reason: "Use people instead")
  }

  type VolunteerGroup implements GroupItem & Node {
    id: ID!

    title: String
    summary: String
    groupType: String
    leaders: [Person]
    members: [Person]
    coverImage: ImageMedia
    groupResources: [Resource]
    avatars: [String]

    people(
      first: Int
      after: String
      isLeader: Boolean
    ): PeopleConnection

    chatChannelId: String
  }

  input GroupFilterInput {
    includeTypes: [GROUP_TYPE]
    excludeTypes: [GROUP_TYPE]
    asLeader: Boolean
  }

  extend type Person {
    groups(input: GroupFilterInput): [GroupItem]
    isGroupLeader: Boolean
  }

  extend type Mutation {
    addMemberAttendance(id: ID!): Group
  }
`;

export default groupSchema;
