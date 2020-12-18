import ApollosConfig from '@apollosproject/config';
import { AuthenticationError } from 'apollo-server';

const { ROCK } = ApollosConfig;
const { APOLLOS_SECRET } = ROCK;

export default {
  Mutation: {
    flushRock: (root, { key, ...args }, { dataSources: { Cache } }) => {
      if (key === APOLLOS_SECRET) {
        return Cache.flushFor('ROCK', args);
      }

      throw new AuthenticationError(
        'Attempting to flush a Rock cache without a valid Apollos Key'
      );
    },
  },
};
