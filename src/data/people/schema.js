import { gql } from 'apollo-server'

export default gql`
    enum GENDER {
        Male
        Female
        Unknown
    }

    enum UPDATEABLE_PROFILE_FIELDS {
        FirstName
        LastName
        Email
        NickName
        Gender
        BirthDate
        Ethnicity
        BaptismDate
        SalvationDate
    }

    enum UPDATEABLE_COMMUNICATION_PREFERENCES {
        SMS
        Email
    }

    input UpdateProfileInput {
        field: UPDATEABLE_PROFILE_FIELDS!
        value: String!
    }

    type Person implements Node @cacheControl(maxAge: 0) {
        id: ID!
        firstName: String
        lastName: String!
        nickName: String
        email: String
        phoneNumber: String
        gender: GENDER
        birthDate: String
        photo: ImageMediaSource
        ethnicity: String
        address: Address
        baptismDate: String
        salvationDate: String
        communicationPreferences: CommunicationPreferences
    }

    type CommunicationPreferences {
        allowSMS: Boolean
        allowEmail: Boolean
        allowPushNotification: Boolean
    }

    extend type Mutation {
        updateProfileField(input: UpdateProfileInput!): Person
        updateProfileFields(input: [UpdateProfileInput]!): Person
        uploadProfileImage(file: Upload!, size: Int!): Person
        updateAddress(street1: String!, street2: String, city: String!, state: String!, postalCode: String!): Address
        updateCommunicationPreference(type: UPDATEABLE_COMMUNICATION_PREFERENCES!, allow: Boolean!): Person
    }

    extend type Query {
        getEthnicityList: DefinedValueList
    }
`