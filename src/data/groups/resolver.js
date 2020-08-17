import { Group as baseGroup } from '@apollosproject/data-connector-rock';
import { resolverMerge } from '@apollosproject/server-core';

const resolver = {
  Group: {
    title: ({ name }, args, { dataSources }) => name,
    summary: ({ description }, args, { dataSources }) => description,
    schedule: ({ scheduleId }, args, { dataSources }) =>
      dataSources.Group.getScheduleFromId(scheduleId),
    groupType: ({ groupTypeId }, args, { dataSources }) =>
      dataSources.Group.getGroupTypeFromId(groupTypeId),
    coverImage: (root, args, { dataSources: { ContentItem } }) =>
      ContentItem.getCoverImage(root),
    avatars: ({ id }, args, { dataSources }) =>
      dataSources.Group.getAvatars(id),
    groupResources: (root, args, { dataSources }) =>
      dataSources.Group.getResources(root),
    dateTime: ({ scheduleId }, args, { dataSources }) =>
      dataSources.Group.getDateTimeFromId(scheduleId),
    videoCall: (root, args, { dataSources }) =>
      dataSources.Group.getGroupVideoCallParams(root),
    parentVideoCall: (root, args, { dataSources }) =>
      dataSources.Group.getGroupParentVideoCallParams(root),
  },
};

export default resolverMerge(resolver, baseGroup);
