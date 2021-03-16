import { createGlobalId } from '@apollosproject/server-core';
import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';

export default class FeatureFeed extends coreFeatureFeed.dataSource {
  superGetFeed = this.getFeed;

  getFeed = async ({ type = '', args = {} }) => {
    const { ContentChannel, PageBuilder } = this.context.dataSources;

    if (type === 'contentChannel') {
      return {
        __typename: 'FeatureFeed',
        id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
        getFeatures: () => ContentChannel.getFeatures(args.contentChannelId),
      };
    }

    if (type === 'pageBuilder') {
      return {
        __typename: 'FeatureFeed',
        id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
        getFeatures: () => PageBuilder.getFeatures(args.pathname),
      };
    }

    return this.superGetFeed({ type, args });
  };
}
