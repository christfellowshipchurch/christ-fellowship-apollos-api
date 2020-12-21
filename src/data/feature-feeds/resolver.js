import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';
import { resolverMerge } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';

const { CONTENT_CHANNEL_FEEDS } = ApollosConfig;

const resolver = {
  Query: {
    homeFeedFeatures: (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'contentChannel',
        args: { contentChannelId: CONTENT_CHANNEL_FEEDS.HOME_FEEDS, ...args },
      }),
    connectFeedFeatures: async (root, args, { dataSources: { Feature } }) =>
      Feature.getConnectFeedFeatures(),
    eventsFeedFeatures: async (root, args, { dataSources: { Feature } }) =>
      Feature.getEventsFeedFeatures(),
    giveFeedFeatures: (root, args, { dataSources: { FeatureFeed } }) =>
      console.log({ FeatureFeed }) ||
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'FEATURE_FEEDS.GIVE', ...args },
      }),
    userHeaderFeatures: async (root, args, { dataSources: { Feature, Flag } }) =>
      Feature.getHomeHeaderFeedFeatures(),
  },
};

export default resolverMerge(resolver, coreFeatureFeed);
