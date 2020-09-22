import { resolverMerge } from '@apollosproject/server-core';
import * as coreLiveStream from '@apollosproject/data-connector-church-online';
import moment from 'moment';

const resolver = {
  LiveStream: {
    ...coreLiveStream.resolver.LiveStream,
    checkin: ({ id }, args, { dataSources: { CheckInable } }, { parentType }) =>
      CheckInable.getByContentItem(id),
  },
  Query: {
    floatLeftLiveStream: (root, args, { dataSources }) => ({
      isLive: true,
      eventStartTime: moment().add(15, 'minutes').utc().toISOString(),
      title: 'Always Live',
      contentItem: dataSources.ContentItem.getFromId(7565),
      media: {
        sources: [
          {
            uri:
              'https://link.theplatform.com/s/IfSiAC/media/h9hnjqraubSs/file.m3u8?metafile=false&formats=m3u&auto=true',
          },
        ],
      },
    }),
    floatLeftEmptyLiveStream: (root, args, { dataSources }) => null,
  },
};

export default resolverMerge(resolver, coreLiveStream);
