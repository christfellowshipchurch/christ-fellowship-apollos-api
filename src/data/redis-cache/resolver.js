import ApollosConfig from '@apollosproject/config';
import { AuthenticationError } from 'apollo-server';

const { ROCK } = ApollosConfig;
const { APOLLOS_SECRET } = ROCK;

export default {
  Mutation: {
    flushRock: async (root, { key, ...args }, { dataSources: { CacheManager } }) => {
      if (key === APOLLOS_SECRET) {
        try {
          console.log('\n\x1b[35m[redis cache] starting recursive clear');

          await CacheManager.recursivelyClear(args);

          console.log('[redis cache] finished recursive clear\x1b[0m\n');
        } catch (e) {
          console.warn('Unable to clear cache');
          console.log({ e });
        }

        return;
      }

      throw new AuthenticationError(
        'Attempting to flush a Rock cache without a valid Apollos Key'
      );
    },
  },
};
