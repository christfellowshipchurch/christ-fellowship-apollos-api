import { resolverMerge, createGlobalId } from '@apollosproject/server-core'
import * as coreLiveStream from '@apollosproject/data-connector-church-online'
import moment from 'moment'

const resolver = {
  LiveNode: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type)
  },
  LiveStream: {
    id: ({ id, eventStartTime, eventEndTime }, args, context, { parentType }) =>
      createGlobalId(JSON.stringify({ id, eventStartTime, eventEndTime }), parentType.name),
    isLive: ({ id, eventStartTime, eventEndTime }) =>
      moment().isBetween(eventStartTime, eventEndTime),
    relatedNode: ({ id, guid }, args, { dataSources }) => {
      if (id) {
        const { LiveStream } = dataSources

        return LiveStream.getRelatedNodeFromId(id)
      }
    },
    chatChannelId: ({ id, eventStartTime, eventEndTime }) => {
      //
    },
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
