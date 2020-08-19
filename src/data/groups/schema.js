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
    name: String
    title: String
    groupType: String
    summary: String
    leaders: [Person]
    members: [Person]
    avatars: [String]
    phoneNumbers: [String]
    schedule: Schedule
    coverImage: ImageMedia
    groupResources: [Resource]
    dateTime: DateTime
    videoCall: VideoCallParams
    parentVideoCall: VideoCallParams
  }

  extend type Person {
    groups(type: GROUP_TYPE, asLeader: Boolean): [Group]
    isGroupLeader: Boolean
  }
`;

export default groupSchema;
