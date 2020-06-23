import { gql } from 'apollo-server'

export default gql`
    type CheckInable implements Node {
        id: ID!
        title: String
        message: String
        isCheckedIn: Boolean @cacheControl(maxAge: 10)
    }

    extend type EventContentItem {
        checkin: CheckInable
    }
`