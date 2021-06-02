import ApollosConfig from '@apollosproject/config';
import { Group as baseGroup } from '@apollosproject/data-connector-rock';
import {
  resolverMerge,
  parseGlobalId,
  createGlobalId,
} from '@apollosproject/server-core';
import { get } from 'lodash';
import { rockImageUrl } from '../utils';

function getTransformedCoverImage(uri) {
  if (uri) {
    return rockImageUrl(uri, {
      w: 1920,
      h: 1080,
      format: 'jpg',
      quality: 70,
    });
  }

  return null;
}

const defaultResolvers = {
  id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
  title: (root, args, { dataSources }) => dataSources.GroupItem.getTitle(root),
  summary: ({ description }, args, { dataSources }) => description,
  groupType: ({ attributeValues }, args, { dataSources }) =>
    get(attributeValues, 'preference.valueFormatted'),
  groupResources: (root, args, { dataSources }) =>
    dataSources.GroupItem.getGroupResources(root),
  resources: ({ id }, args, { dataSources }) => dataSources.GroupItem.getResources(id),
  coverImage: async (root, args, { dataSources: { ContentItem } }) => {
    const selectedImage = await ContentItem.getCoverImage(root);
    const sources = selectedImage.sources.map(({ uri }) => ({
      uri: getTransformedCoverImage(uri),
    }));

    return {
      ...selectedImage,
      sources,
    };
  },
  avatars: ({ id }, args, { dataSources }) => dataSources.GroupItem.getAvatars(id),
  members: ({ id }, args, { dataSources }) => dataSources.GroupItem.getMembers(id),
  leaders: ({ id }, args, { dataSources }) => dataSources.GroupItem.getLeaders(id),
  people: async ({ id }, args, { dataSources: { GroupItem } }) =>
    GroupItem.paginateMembersById({
      ...args,
      id,
    }),
  chatChannelId: (root, args, { dataSources }) => null, // Deprecated
  streamChatChannel: async (root, args, { dataSources }) =>
    dataSources.GroupItem.getStreamChatChannel(root),
};

const resolver = {
  GroupItem: {
    __resolveType: (root, { dataSources: { Group } }) => Group.resolveType(root),
  },
  Group: {
    ...defaultResolvers,
    schedule: ({ scheduleId }, args, { dataSources }) =>
      dataSources.GroupItem.getScheduleFromId(scheduleId),
    phoneNumbers: ({ id }, args, { dataSources }) =>
      dataSources.GroupItem.groupPhoneNumbers(id),
    dateTime: ({ scheduleId }, args, { dataSources }) =>
      dataSources.GroupItem.getDateTimeFromId(scheduleId),
    videoCall: async (root, args, { dataSources }) => {
      const { GroupItem } = dataSources;
      return GroupItem.getGroupVideoCallParams(root);
    },
    parentVideoCall: async (root, args, { dataSources }) => {
      const { GroupItem } = dataSources;

      return GroupItem.getGroupParentVideoCallParams(root);
    },
    allowMessages: (root, args, { dataSources }) =>
      dataSources.GroupItem.allowMessages(root),
    checkin: ({ id }, args, { dataSources: { CheckInable } }) =>
      CheckInable.getFromId(id),
    campus: ({ campusId }, args, { dataSources }) =>
      dataSources.Campus.getFromId(campusId),
    preference: (root, args, { dataSources }) =>
      dataSources.GroupItem.getPreference(root),
    subPreference: (root, args, { dataSources }) =>
      dataSources.GroupItem.getSubPreference(root),
    meetingType: (root, args, { dataSources }) =>
      dataSources.GroupItem.getMeetingType(root),
  },
  VolunteerGroup: {
    ...defaultResolvers,
    id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
    checkin: ({ id }, args, { dataSources: { CheckInable } }) =>
      CheckInable.getFromId(id),
  },
  Mutation: {
    addMemberAttendance: async (root, { id }, { dataSources }) => {
      const globalId = parseGlobalId(id);
      try {
        return dataSources.Group.addMemberAttendance(globalId.id);
      } catch (e) {
        console.log({ e });
      }

      return null;
    },
    updateGroupCoverImage: async (root, { imageId, groupId }, { dataSources }) => {
      try {
        return dataSources.GroupItem.updateCoverImage({
          groupId,
          imageId,
        });
      } catch (e) {
        console.log({ e });
      }

      return null;
    },
    updateGroupResourceUrl: async (
      root,
      { groupId, relatedNodeId, title, url },
      { dataSources }
    ) => {
      try {
        if (relatedNodeId) {
          return dataSources.GroupItem.updateResource({
            groupId,
            relatedNodeId,
            title,
            url,
          });
        }
        return dataSources.GroupItem.addResource({ groupId, title, url });
      } catch (e) {
        console.log({ e });
      }

      return null;
    },
    updateGroupResourceContentItem: async (
      root,
      { groupId, relatedNodeId, contentItemId },
      { dataSources }
    ) => {
      try {
        if (relatedNodeId) {
          return dataSources.GroupItem.updateResource({
            groupId,
            relatedNodeId,
            contentItemId,
          });
        }
        return dataSources.GroupItem.addResource({
          groupId,
          contentItemId,
        });
      } catch (e) {
        console.log({ e });
      }

      return null;
    },
    removeGroupResource: async (root, { groupId, relatedNodeId }, { dataSources }) => {
      try {
        return dataSources.GroupItem.removeResource({ groupId, relatedNodeId });
      } catch (e) {
        console.log({ e });
      }
    },
    indexGroup: async (root, { id, key, action }, { dataSources }) => {
      const validInput = Boolean(
        id && action && key === ApollosConfig.ROCK.APOLLOS_SECRET
      );

      if (!validInput) {
        return `Failed to update | id: ${id} | action: ${action}`;
      }

      switch (action) {
        case 'delete':
          // TODO
          // dataSources.GroupItem.deleteIndexGroup(id);
          return `⚠️ Action 'delete' not implemented | id: ${id} | action: ${action}`;
        case 'update':
          await dataSources.GroupItem.updateIndexGroup(id);
          return `Successfully updated | id: ${id} | action: ${action}`;
        default:
          return `Unhandled INDEX_ACTION`;
      }
    },
    indexAllGroups: async (root, { id, key, action }, { dataSources }) => {
      const validInput = Boolean(action && key === ApollosConfig.ROCK.APOLLOS_SECRET);

      if (!validInput) {
        return `Failed to update | action: ${action}`;
      }

      switch (action) {
        case 'update':
          await dataSources.GroupItem.updateIndexAllGroups();
          return `Successfully updated | action: ${action}`;
        default:
          return `Unhandled INDEX_ACTION`;
      }
    },
    contactGroupLeader: async (root, { groupId }, { dataSources }) => {
      try {
        return dataSources.GroupItem.contactLeader({ groupId });
      } catch (e) {
        console.log({ e });
      }
    },
  },
  Query: {
    groupCoverImages: async (root, args, { dataSources }) =>
      dataSources.GroupItem.getCoverImages(),
    groupResourceOptions: async (root, { groupId, input }, { dataSources }) => {
      const { id } = parseGlobalId(groupId);
      return dataSources.ContentItem.paginate({
        cursor: await dataSources.GroupItem.getResourceOptions(id),
        args: input,
      });
    },
    searchGroups: async (root, args, { dataSources }) =>
      dataSources.GroupItem.searchGroups(args),
    groupSearchOptions: async (root, args, { dataSources }) =>
      dataSources.GroupItem.getGroupSearchOptions(),
    groupSearchFacetsAttributes: async (root, args, { dataSources }) =>
      dataSources.GroupItem.getGroupSearchFacetsAttributes(),
    groupFacetFilters: async (root, { facet, facetFilters }, { dataSources }) =>
      dataSources.GroupItem.getGroupFacetsByFilters(facet, facetFilters),
  },
};

export default resolverMerge(resolver, baseGroup);
