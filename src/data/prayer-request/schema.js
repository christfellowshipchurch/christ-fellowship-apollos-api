import { gql } from 'apollo-server';
import { prayerSchema } from '@apollosproject/data-schema';

// todo : the Core Prayer schema is missing some definitions and extensions that are present in the resolver. Bring back the Core Package when that is confirmed to be settled

export default gql`
  type PrayerRequest implements Node {
    id: ID!
    text: String!
    requestor: Person
    isAnonymous: Boolean
    isPrayed: Boolean
  }

  type PrayerListFeature implements Feature & Node {
    id: ID!
    order: Int
    isCard: Boolean
    title: String
    subtitle: String
    prayers: [PrayerRequest]
  }

  type VerticalPrayerListFeature implements Feature & Node {
    id: ID!
    order: Int
    title: String
    subtitle: String
    prayers: [PrayerRequest]
  }

  extend type Mutation {
    addPrayer(text: String!, isAnonymous: Boolean): PrayerRequest
  }

  extend enum InteractionAction {
    PRAY
  }

  extend type Person {
    prayers: [PrayerRequest]
  }

  extend type PrayerRequest {
    requestedDate: String
  }

  extend type Query {
    currentUserPrayerRequests(first: Int, after: String): NodeConnection
  }
`;
