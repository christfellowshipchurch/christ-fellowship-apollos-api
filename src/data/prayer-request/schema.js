import { gql } from 'apollo-server'
import { prayerSchema } from '@apollosproject/data-schema'

export default gql`
    ${prayerSchema}

    extend type PrayerRequest {
        requestedDate: String
    }

    input PrayerRequestsConnectionInput {
        first: Int
        after: String
    }

    type PrayerRequestsConnection {
        edges: [PrayerRequestsConnectionEdge]
        totalCount: Int
        pageInfo: PaginationInfo
    }

    type PrayerRequestsConnectionEdge {
        node: PrayerRequest
        cursor: String
    }

    extend type Query {
        currentUserPrayerRequests(
            first: Int
            after: String
        ): PrayerRequestsConnection
    }
`
