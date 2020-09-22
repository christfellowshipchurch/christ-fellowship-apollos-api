import { gql } from 'apollo-server';

export default gql`
  type CheckInable implements Node {
    id: ID!
    title: String
    message: String
    isCheckedIn: Boolean @cacheControl(maxAge: 10)
  }

  interface CheckInableNode {
    checkin: CheckInable
  }

  extend type EventContentItem implements CheckInableNode {
    checkin: CheckInable
  }

  extend type LiveStream implements CheckInableNode {
    checkin: CheckInable
  }

  extend type Mutation {
    checkInCurrentUser(id: ID!): CheckInableNode
  }
`;
