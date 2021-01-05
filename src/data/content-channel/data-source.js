import { ContentChannel as coreContentChannel } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { isEmpty } from 'lodash';

import { createVideoUrlFromGuid } from '../utils';

const { ROCK_MAPPINGS } = ApollosConfig;

export default class ContentChannel extends coreContentChannel.dataSource {
  getEventChannels = () => {};

  getFromIds = (ids) => this.getContentChannelsFromIds(ids);

  getContentChannelsFromIds = async (ids) => {
    const channels = await this.request()
      .filter(ids.map((channelId) => `(Id eq ${channelId})`).join(' or '))
      .cache({ ttl: 5 })
      .get();

    const sortOrder = ids;
    // Sort order could be undefined or have no ids. There's no reason to iterate in this case.
    if (!sortOrder || isEmpty(sortOrder)) {
      return channels;
    }
    // Setup a result array.
    const result = [];
    sortOrder.forEach((configId) => {
      // Remove the matched element from the channel list.
      const channel = channels.splice(
        channels.findIndex(({ id }) => id === configId),
        1
      );
      // And then push it (or nothing) to the end of the result array.
      result.push(...channel);
    });
    // Return results and any left over channels.
    return [...result, ...channels];
  };

  getContentItemIds = (contentChannelId) => {
    const { Cache, ContentItem } = this.context.dataSources;
    const request = () =>
      this.request('ContentChannelItems')
        .filter(`ContentChannelId eq ${contentChannelId}`)
        .andFilter(ContentItem.LIVE_CONTENT())
        .cache({ ttl: 60 })
        .orderBy('Order', 'asc')
        .transform((results) => results.filter((item) => !!item.id).map(({ id }) => id))
        .get();

    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.contentChannelItemIds`${contentChannelId}`,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });
  };
}
