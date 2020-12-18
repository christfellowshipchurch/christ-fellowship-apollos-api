import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';
import { resolverMerge } from '@apollosproject/server-core';

const resolver = {
  Query: {
    homeFeedFeatures: (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'HOME_FEATURES', ...args },
      }),
  },
};

export default resolverMerge(resolver, coreFeatureFeed);
