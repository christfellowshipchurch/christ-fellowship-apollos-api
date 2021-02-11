import { gql } from 'apollo-server';
import { prayerSchema } from '@apollosproject/data-schema';

export default gql`
  ${prayerSchema}

  extend type PrayerRequest {
    requestedDate: String
  }

  extend type Query {
    currentUserPrayerRequests(first: Int, after: String): NodeConnection
  }
`;
