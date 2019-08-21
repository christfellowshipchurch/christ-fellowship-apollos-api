import { gql } from 'apollo-server'

export default gql`
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