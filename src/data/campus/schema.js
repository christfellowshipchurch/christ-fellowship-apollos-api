import { gql } from 'apollo-server'

export default gql`
    type ServiceTime {
        day: String
        time: String
    }

    type CampusFeature {
        title: String
        summary: String
        htmlContent: String
        options: [String]
        icon: String
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
        campusFeatures: [CampusFeature]
    }

    extend type Query {
        campuses(location: CampusLocationInput): [Campus]
        campus(name: String!): Campus
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