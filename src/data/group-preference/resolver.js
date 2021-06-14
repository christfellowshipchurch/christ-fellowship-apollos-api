import ApollosConfig from '@apollosproject/config';
import { createGlobalId, parseGlobalId } from '@apollosproject/server-core';
import { get, isEmpty } from 'lodash';
import { rockImageUrl } from '../utils';

const { ROCK_MAPPINGS } = ApollosConfig;
const { DEFINED_TYPES, NOTIFY_ME_BANNERS_CHANNEL_ID } = ROCK_MAPPINGS;
const { GROUP_SUB_PREFERENCE_IMAGES } = DEFINED_TYPES;

function getTransformedCoverImage(item) {
  const coverImageGuid = get(item.attributeValues, 'image.value', null);

  if (coverImageGuid) {
    return rockImageUrl(coverImageGuid, {
      w: 768,
      format: 'jpg',
      quality: 70,
    });
  }

  return null;
}

const resolver = {
  GroupPreference: {
    id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
    title: ({ value, attributeValues }) =>
      get(attributeValues, 'titleOverride.value', null)
        ? attributeValues.titleOverride.value
        : value,
    summary: ({ description }) => description,
    coverImage: async (
      root,
      args,
      { dataSources: { DefinedValueList, DefinedValue } }
    ) => {
      const { nodeId } = args;
      let uniqueImage = null;

      if (nodeId) {
        const parsedId = parseGlobalId(nodeId);
        if (parsedId.id && root.guid) {
          const definedType = await DefinedValueList.getByIdentifier(
            GROUP_SUB_PREFERENCE_IMAGES
          );
          const { definedValues } = definedType;
          const parentEntity = await DefinedValue.getFromId(parsedId.id);

          uniqueImage = definedValues.find(({ attributeValues }) => {
            const parent = get(attributeValues, 'preference.value');
            const child = get(attributeValues, 'subPreference.value');

            return child === root.guid && parent === parentEntity.guid;
          });
        }
      }

      return {
        sources: [
          {
            uri: getTransformedCoverImage(uniqueImage || root),
          },
        ],
      };
    },
    url: ({ attributeValues }) => get(attributeValues, 'url.value', null),
    routing: (root, args, context, { parentType }) => ({
      ...root,
      __typename: parentType,
    }),
  },
  Query: {
    allPreferences: async (root, args, { dataSources }) =>
      dataSources.GroupPreference.getGroupPreferences(),
    allSubPreferences: async (root, args, { dataSources }) =>
      dataSources.GroupPreference.getGroupSubPreferences(),
    groupSubPreferences: async (root, { id }, { dataSources }) =>
      dataSources.GroupPreference.getGroupSubPreferences(),
    notifyMeBanner: async (
      root,
      { preferenceId },
      { dataSources: { ContentItem, GroupPreference } }
    ) => {
      const globalId = parseGlobalId(preferenceId);

      if (globalId.id) {
        const { id } = globalId;
        const groupPreference = await GroupPreference.getFromId(id);

        if (groupPreference.guid) {
          const { guid } = groupPreference;

          return ContentItem.byAttributeValue('GroupPreference', guid)
            .andFilter(`ContentChannelId eq ${NOTIFY_ME_BANNERS_CHANNEL_ID}`)
            .first();
        }
      }

      return null;
    },
  },
  Mutation: {
    subscribeToGroupPreference: async (
      root,
      { groupPreferenceId, campusId },
      { dataSources: { GroupPreference } }
    ) => {
      const globalGroupPreferenceId = parseGlobalId(groupPreferenceId);
      const globalCampusId = parseGlobalId(campusId);

      if (isEmpty(globalGroupPreferenceId.id) || isEmpty(globalCampusId.id)) return null;

      return GroupPreference.subscribeToUpdates({
        preferenceId: globalGroupPreferenceId.id,
        campusId: globalCampusId.id,
      });
    },
  },
};

export default resolver;
