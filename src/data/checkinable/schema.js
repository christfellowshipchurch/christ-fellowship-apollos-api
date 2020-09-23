import { gql } from 'apollo-server'

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

    extend type EventContentItem implements CheckInableNode
    extend type EventContentItem {
        checkin: CheckInable
    }

    extend type LiveStream implements CheckInableNode
    extend type LiveStream {
        checkin: CheckInable
    }

    extend type Mutation {
        checkInCurrentUser(id: ID!): CheckInable
    }
`