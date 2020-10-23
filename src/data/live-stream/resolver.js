import { createGlobalId, resolverMerge } from '@apollosproject/server-core'
import * as coreLiveStream from '@apollosproject/data-connector-church-online'
import { get } from 'lodash';
import moment from 'moment'

const resolver = {
  LiveNode: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type),
  },
  LiveStream: {
    id: ({ id, eventStartTime, eventEndTime }, args, context, { parentType }) =>
      createGlobalId(
        JSON.stringify({ id, eventStartTime, eventEndTime }),
        parentType.name
      ),
    isLive: ({ id, eventStartTime, eventEndTime }) =>
      moment().isBetween(eventStartTime, eventEndTime),
    media: ({ attributeValues }) => {
      const liveStreamUrl = get(attributeValues, 'liveStreamUrl.value')

      if (liveStreamUrl) {
        return { sources: [{ uri: liveStreamUrl }] }
      }

      return null
    },
    contentItem: ({ contentChannelItemId }, _, { models, dataSources }) => {
      if (contentChannelItemId) {
        const { ContentItem } = dataSources;

        return ContentItem.getFromId(contentChannelItemId);
      }

      return null;
    },
    relatedNode: async (
      { id, contentChannelItemId },
      _,
      { models, dataSources },
      resolveInfo
    ) => {
      try {
        let globalId = '';

        // If we know that the related node is a content channel item, let's just query for that
        if (contentChannelItemId) {
          const { ContentItem } = dataSources;
          const contentItem = await ContentItem.getFromId(contentChannelItemId);

          const resolvedType = ContentItem.resolveType(contentItem);
          globalId = createGlobalId(contentChannelItemId, resolvedType);
        } else if (id) {
          // If we don't know the related node type, we need to manually figure it out
          const { LiveStream } = dataSources;
          const unresolvedNode = await LiveStream.getRelatedNodeFromId(id);

          const { globalId: relatedNodeGlobalId } = unresolvedNode;
          globalId = relatedNodeGlobalId;
        }

        return await models.Node.get(globalId, dataSources, resolveInfo);
      } catch (e) {
        console.log(`Error fetching live stream related node ${id}`, e);
        return null;
      }
    },
    streamChatChannel: ({ id, eventStartTime, eventEndTime }) => {
      return { id: JSON.stringify({ id, eventStartTime, eventEndTime }) }
    },
    checkin: ({ attributeValues }, args, { dataSources: { CheckInable } }) => {
      const groupId = get(attributeValues, 'checkInGroup.value', '');

      return CheckInable.getById(groupId);
    },
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
