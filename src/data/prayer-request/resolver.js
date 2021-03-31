import { PrayerRequest as corePrayerRequest } from '@apollosproject/data-connector-rock';
import { resolverMerge, withEdgePagination } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';
import moment from 'moment-timezone';

const { ROCK } = ApollosConfig;

const resolver = {
  PrayerRequest: {
    requestedDate: ({ enteredDateTime }) =>
      moment(enteredDateTime).tz(ROCK.TIMEZONE).utc().format(),
  },
  Query: {
    currentUserPrayerRequests: async (root, args, { dataSources }) =>
      dataSources.PrayerRequest.paginate({
        cursor: await dataSources.PrayerRequest.byCurrentUser(),
        args,
      }),
  },
};

export default resolverMerge(resolver, corePrayerRequest);
