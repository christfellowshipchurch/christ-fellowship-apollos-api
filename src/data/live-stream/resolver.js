import { createGlobalId, resolverMerge } from '@apollosproject/server-core'
import * as coreLiveStream from '@apollosproject/data-connector-church-online'
import { get } from 'lodash';
import crypto from 'crypto-js'
import moment from 'moment'

const resolver = {
  LiveStream: {
    ...coreLiveStream.resolver.LiveStream,
    chatChannelId: async (root, args, { dataSources }) => {
      const { ContentItem } = dataSources;

      const id = get(root, 'contentItem.id');
      const contentItem = await ContentItem.getFromId(id);

      const resolvedType = ContentItem.resolveType(contentItem);
      const globalId = createGlobalId(id, resolvedType);

      const startTime = get(root, 'contentItem.nextOccurrences[0].start');
      const endTime = get(root, 'contentItem.nextOccurrences[0].end');
      return crypto.SHA1(`${globalId}${startTime}${endTime}`).toString();
    },
  },
  Query: {
    floatLeftLiveStream: (root, args, { dataSources }) => ({
      isLive: true,
      eventStartTime: moment().add(15, "minutes").utc().toISOString(),
      title: "Always Live",
      contentItem: dataSources.ContentItem.getFromId(7565),
      media: {
        sources: [
          {
            uri: "https://link.theplatform.com/s/IfSiAC/media/h9hnjqraubSs/file.m3u8?metafile=false&formats=m3u&auto=true"
          }
        ]
      },
    }),
    floatLeftEmptyLiveStream: (root, args, { dataSources }) => null
  }
}

export default resolverMerge(resolver, coreLiveStream)
