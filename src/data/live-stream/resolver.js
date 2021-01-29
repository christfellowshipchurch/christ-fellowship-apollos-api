import { createGlobalId, resolverMerge } from '@apollosproject/server-core';
import * as coreLiveStream from '@apollosproject/data-connector-church-online';
import { Utils } from '@apollosproject/data-connector-rock';
import { get, isEmpty } from 'lodash';
import moment from 'moment';

const { createImageUrlFromGuid } = Utils;

const resolver = {
  LiveNode: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type),
  },
  LiveStream: {
    id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
    eventStartTime: async (root, _, { dataSources }) => {
      const { LiveStream } = dataSources;
      const nextInstance = await LiveStream.getNextInstance(root);

      if (nextInstance) {
        const { start } = nextInstance;
        return start;
      }

      return null;
    },
    eventEndTime: async (root, _, { dataSources }) => {
      const { LiveStream } = dataSources;
      const nextInstance = await LiveStream.getNextInstance(root);

      if (nextInstance) {
        const { end } = nextInstance;
        return end;
      }

      return null;
    },
    isLive: async (root, _, { dataSources }) => {
      const { LiveStream } = dataSources;
      const nextInstance = await LiveStream.getNextInstance(root);

      if (nextInstance) {
        const { start, end } = nextInstance;
        return moment().isBetween(start, end);
      }

      return false;
    },
    media: ({ attributeValues }) => {
      const uri = get(attributeValues, 'url.value');

      if (uri) {
        return { sources: [{ uri }] };
      }

      return null;
    },
    actions: async ({ id, guid }, args, { dataSources }) => {
      return [];

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
    contentItem: ({ attributeValues }, _, { dataSources }) => {
      const contentItemId = attributeValues?.contentItem?.value;
      if (contentItemId && !isEmpty(contentItemId)) {
        const { ContentItem } = dataSources;
        return ContentItem.getFromId(contentItemId);
      }

      return null;
    },
    relatedNode: async ({ attributeValues }, _, { dataSources }) => {
      const contentItemId = attributeValues?.contentItem?.value;
      if (contentItemId && !isEmpty(contentItemId)) {
        const { ContentItem } = dataSources;
        const contentItem = await ContentItem.getFromId(contentItemId);
        const __typename = ContentItem.resolveType(contentItem);

        return {
          __typename,
          ...contentItem,
        };
      }

      return null;
    },
    streamChatChannel: async (root, _, { dataSources }) =>
      dataSources.LiveStream.getStreamChatChannel(root),
    checkin: ({ attributeValues }, args, { dataSources: { CheckInable } }) => {
      const groupId = get(attributeValues, 'checkInGroup.value', '');

      return CheckInable.getById(groupId);
    },
  },
  Query: {
    floatLeftLiveStream: async (root, args, { dataSources }) => {
      /**
       * Beacuse the TV apps are a bit more sensative to errors, we
       * want to capture all data fetching in a try catch with very,
       * very explicit error handling and defaulting all return values
       * to `null`
       */
      const { LiveStream } = dataSources;
      try {
        /**
         * getLiveStreams returns an array of Live Stream objects, but this
         * specific endpoint only returns a single Live Stream.
         */
        const allActiveLiveStreams = await LiveStream.getLiveStreams({
          anonymously: true,
        });

        if (allActiveLiveStreams && allActiveLiveStreams.length > 0) {
          return allActiveLiveStreams[0];
        }
      } catch (e) {
        console.log('Error when fetching live streams for TV Apps');
        console.log({ e });
      }

      return null;
    },
    floatLeftEmptyLiveStream: (root, args, { dataSources }) => null,
  },
};

export default resolverMerge(resolver, coreLiveStream);
