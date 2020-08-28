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

  type Resource {
    title: String
    url: String
    contentChannelItem: String
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
  }

  type Group implements Node {
    id: ID!
    allowMessages: String
    avatars: [String]
    coverImage: ImageMedia
    dateTime: DateTime
    groupResources: [Resource]
    groupType: String
    leaders: [Person]
    members: [Person]
    parentVideoCall: VideoCallParams
    phoneNumbers: [String]
    schedule: Schedule
    summary: String
    title: String
    videoCall: VideoCallParams
  }

  extend type Person {
    groups(type: GROUP_TYPE, asLeader: Boolean): [Group]
    isGroupLeader: Boolean
  }

  extend type Mutation {
    addMemberAttendance(id: ID!): Group
  }
`;

export default groupSchema;
