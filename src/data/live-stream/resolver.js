import { createGlobalId, resolverMerge } from '@apollosproject/server-core';
import * as coreLiveStream from '@apollosproject/data-connector-church-online';
import { Utils } from '@apollosproject/data-connector-rock';
import { get } from 'lodash';
import moment from 'moment';

const { createImageUrlFromGuid } = Utils;

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
      const liveStreamUrl = get(attributeValues, 'liveStreamUrl.value');

      if (liveStreamUrl) {
        return { sources: [{ uri: liveStreamUrl }] };
      }

      return null;
    },
    actions: async ({ id, guid }, args, { dataSources }) => {
      const unresolvedNode = await dataSources.LiveStream.getRelatedNodeFromId(id);
      // Get Matrix Items
      const liveStreamActionsMatrixGuid = get(
        unresolvedNode,
        'attributeValues.liveStreamActions.value',
        ''
      );
      const liveStreamActionsItems = await dataSources.MatrixItem.getItemsFromId(
        liveStreamActionsMatrixGuid
      );

      const liveStreamDefaultActionItems = await dataSources.DefinedValueList.getByIdentifier(
        367
      );

      const liveStreamDefaultActionItemsMapped = liveStreamDefaultActionItems.definedValues.map(
        ({ attributeValues: defaultLiveStreamActionsItemsAttributeValues }) => ({
          action: 'OPEN_URL',
          image: get(defaultLiveStreamActionsItemsAttributeValues, 'image.value', null)
            ? createImageUrlFromGuid(
                defaultLiveStreamActionsItemsAttributeValues.image.value
              )
            : null,
          relatedNode: {
            __typename: 'Url',
            url: get(defaultLiveStreamActionsItemsAttributeValues, 'url.value', null),
          },
          title: get(defaultLiveStreamActionsItemsAttributeValues, 'title.value', null),
        })
      );

      const liveStreamActionsItemsMapped = liveStreamActionsItems.map(
        ({ attributeValues: liveStreamActionsItemsAttributeValues }) => ({
          action: 'OPEN_URL',
          duration: get(liveStreamActionsItemsAttributeValues, 'duration.value', null),
          image: get(liveStreamActionsItemsAttributeValues, 'image.value', null)
            ? createImageUrlFromGuid(liveStreamActionsItemsAttributeValues.image.value)
            : null,
          relatedNode: {
            __typename: 'Url',
            url: get(liveStreamActionsItemsAttributeValues, 'url.value', null),
          },
          start: get(liveStreamActionsItemsAttributeValues, 'startTime.value', null),
          title: get(liveStreamActionsItemsAttributeValues, 'title.value', null),
        })
      );

      return liveStreamDefaultActionItemsMapped.concat(liveStreamActionsItemsMapped);
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
    streamChatChannel: async (
      { id, eventStartTime, eventEndTime },
      _,
      { dataSources: { Flag } }
    ) => {
      const featureFlag = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT');
      if (featureFlag !== 'LIVE') return null;

      return { id: JSON.stringify({ id, eventStartTime, eventEndTime }) };
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
