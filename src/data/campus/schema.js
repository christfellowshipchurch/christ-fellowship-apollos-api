import { gql } from 'apollo-server'

export default gql`
    type ServiceTime {
        day: String
        time: String
    }

    type Campus implements Node {
        id: ID!
        name: String
        street1: String
        street2: String
        city: String
        state: String
        postalCode: String
        latitude: Float
        longitude: Float
        image: ImageMediaSource
        featuredImage: ImageMediaSource
        distanceFromLocation(location: CampusLocationInput): Float
        serviceTimes: [ServiceTime]
    }

    extend type Query {
        campuses(location: CampusLocationInput): [Campus]
    }

    input CampusLocationInput {
        latitude: Float!
        longitude: Float!
    }

    extend type Person {
        campus: Campus
    }

    extend type Mutation {
        updateUserCampus(campusId: String!): Person
    }
`