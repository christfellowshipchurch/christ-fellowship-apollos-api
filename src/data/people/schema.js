import { gql } from 'apollo-server';
import { peopleSchema } from '@apollosproject/data-schema';

export default gql`
  ${peopleSchema}

  extend enum UPDATEABLE_PROFILE_FIELDS {
    Ethnicity
    BaptismDate
    SalvationDate
    PhoneNumber
  }

  enum UPDATEABLE_COMMUNICATION_PREFERENCES {
    SMS
    Email
  }

  extend type Person {
    phoneNumber: String
    ethnicity: String
    address: Address
    baptismDate: String
    salvationDate: String
    communicationPreferences: CommunicationPreferences
  }

  type PeopleConnection {
    edges: [PeopleConnectionEdge]
    totalCount: Int
    pageInfo: PaginationInfo
  }

  type PeopleConnectionEdge {
    node: Person
    cursor: String
  }

  type CommunicationPreferences {
    allowSMS: Boolean
    allowEmail: Boolean
    allowPushNotification: Boolean
  }

  input AddressInput {
    street1: String!
    street2: String
    city: String!
    state: String!
    postalCode: String!
  }

  input UpdateCommunicationPreferenceInput {
    type: UPDATEABLE_COMMUNICATION_PREFERENCES!
    allow: Boolean!
  }

  extend type Mutation {
    updateAddress(address: AddressInput!): Address
    updateCommunicationPreference(
      type: UPDATEABLE_COMMUNICATION_PREFERENCES!
      allow: Boolean!
    ): Person
    updateCommunicationPreferences(input: [UpdateCommunicationPreferenceInput]!): Person
    submitRsvp(input: [Attribute]!): String
    submitEmailCapture(input: [Attribute]!): String
  }

  extend type Query {
    getEthnicityList: DefinedValueList
    getSpouse: Person
    getChildren: [Person]
  }
`;
