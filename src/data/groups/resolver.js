import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import { resolverMerge } from '@apollosproject/server-core';

const { createImageUrlFromGuid } = Utils;

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
    avatars: async ({ id }, args, { dataSources }) => {
      const members = await dataSources.Group.getMembers(id);
      let avatars = [];
      members.map((member) =>
        member.photo.guid
          ? avatars.push(createImageUrlFromGuid(member.photo.guid))
          : null
      );
      return avatars;
    },
  },
};

export default resolverMerge(resolver, baseGroup);
