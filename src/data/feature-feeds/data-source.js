import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';

export default class FeatureFeed extends coreFeatureFeed.dataSource {
  getFeed = async ({ type = '', args = {} }) => {
    const { ContentChannel } = this.context.dataSources;
    if (type === 'contentChannel') {
      return {
        __typename: 'FeatureFeed',
        id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
        getFeatures: ContentChannel.getFeatures(args.contentChannelId),
      };
    }

    return super.getFeed({ type, args });
  };
}
