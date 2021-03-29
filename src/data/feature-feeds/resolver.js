import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';
import { resolverMerge } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';

const { CONTENT_CHANNEL_FEEDS, CONNECT_TAB } = ApollosConfig;

const resolver = {
  Query: {
    connectFeedFeatures: async (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'CONNECT_FEATURES', ...args },
      }),
    eventsFeedFeatures: async (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'EVENTS_FEATURES', ...args },
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
    featuresFeed: (root, { pathname, ...args }, { dataSources: { FeatureFeed } }) => {
      switch (pathname) {
        case 'connect':
          return FeatureFeed.getFeed({
            type: 'apollosConfig',
            args: { section: 'CONNECT_FEATURES', ...args },
          });
        case 'events':
          return FeatureFeed.getFeed({
            type: 'apollosConfig',
            args: { section: 'EVENTS_FEATURES', ...args },
          });
        case 'home':
          return FeatureFeed.getFeed({
            type: 'contentChannel',
            args: { contentChannelId: CONTENT_CHANNEL_FEEDS.HOME_FEED, ...args },
          });
        case 'give':
          return FeatureFeed.getFeed({
            type: 'apollosConfig',
            args: { section: 'GIVE_FEATURES', ...args },
          });
        default:
          return FeatureFeed.getFeed({
            type: 'pageBuilder',
            args: { pathname, ...args },
          });
      }
    },
    giveFeedFeatures: (root, args, { dataSources: { FeatureFeed } }) =>
      FeatureFeed.getFeed({
        type: 'apollosConfig',
        args: { section: 'GIVE_FEATURES', ...args },
      }),
  },
};

export default resolverMerge(resolver, coreFeatureFeed);
