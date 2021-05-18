import { createGlobalId } from '@apollosproject/server-core';
import { get, keys, kebabCase } from 'lodash';
import ApollosConfig from '@apollosproject/config';

const { ROCK_MAPPINGS } = ApollosConfig;
const { CONTENT_CHANNEL_PATHNAMES } = ROCK_MAPPINGS;

const resolver = {
  Url: {
    id: (root, args, context, { parentType }) => {
      return createGlobalId(JSON.stringify(root), parentType.name);
    },
  },
  Route: {
    __resolveType: () => 'Route',
    pathname: async (
      { __typename, id, ...node },
      args,
      { dataSources: { ContentItem } }
    ) => {
      switch (`${__typename}`) {
        case 'GroupPreference':
          // note : Group Preferences get returned as Defined Value
          const title = get(node, 'attributeValues.titleOverride.value', null)
            ? node.attributeValues.titleOverride.value
            : get(node, 'value');

          return ['community', kebabCase(title)].join('/');
        case 'MediaContentItem':
        default:
          const contentItem = await ContentItem.getFromId(id);
          const pathname = get(contentItem, 'attributeValues.url.value');
          const prefix = keys(CONTENT_CHANNEL_PATHNAMES).find((key) =>
            CONTENT_CHANNEL_PATHNAMES[key].includes(contentItem.contentChannelId)
          );

          if (prefix && prefix !== 'default') {
            return [prefix, pathname].join('/');
          }

          return pathname;
      }
    },
  },
  NodeRoute: {
    __resolveType: () => 'NodeRoute',
  },
};

export default resolver;
