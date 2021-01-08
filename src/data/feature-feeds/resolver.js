import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';
import { resolverMerge } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';

const { CONTENT_CHANNEL_FEEDS } = ApollosConfig;

const resolver = {
  Query: {
    connectFeedFeatures: async (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'CONNECT_TAB', ...args },
      }),
    eventsFeedFeatures: async (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'EVENTS_TAB', ...args },
      }),
    giveFeedFeatures: (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'GIVE_FEATURES', ...args },
      }),
    homeFeedFeatures: (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'contentChannel',
        args: { contentChannelId: CONTENT_CHANNEL_FEEDS.HOME_FEED, ...args },
      }),
    homeHeaderFeedFeatures: async (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'HOME_HEADER_FEATURES', ...args },
      }),
    // ! Deprecated. Please use homeHeaderFeedFeatures instead
    userHeaderFeatures: async (root, args, { dataSources: { Feature, Flag } }) =>
      Feature.getHomeHeaderFeedFeatures(),
  },
};

export default resolverMerge(resolver, coreFeatureFeed);
