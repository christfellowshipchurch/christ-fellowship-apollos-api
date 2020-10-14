import { gql } from 'apollo-server'

export default gql`
    type CheckInOption implements Node {
        id: ID!
        startDateTime: String
        isCheckedIn: Boolean
    }

    type CheckInable implements Node {
        id: ID!
        title: String
        message: String
        isCheckedIn: Boolean @cacheControl(maxAge: 10)

        options: [CheckInOption]
    }

    interface CheckInableNode {
        checkin: CheckInable
    }

    extend type EventContentItem {
        checkin: CheckInable
    }

    extend type VolunteerGroup implements CheckInableNode {
        checkin: CheckInable
    }

    input CheckInOptionInput {
        id: ID
    }

    extend type Mutation {
        checkInCurrentUser(id: ID!, optionIds: [ID]): CheckInable
    }
`