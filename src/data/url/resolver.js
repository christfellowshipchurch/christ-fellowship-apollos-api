import { createGlobalId } from '@apollosproject/server-core';
import { get, keys } from 'lodash';
import ApollosConfig from '@apollosproject/config';

const { ROCK_MAPPINGS } = ApollosConfig;
const { CONTENT_CHANNEL_PATHNAMES } = ROCK_MAPPINGS;

const resolver = {
  Url: {
    id: ({ id }, args, context, { parentType }) => {
      return createGlobalId(id, parentType.name);
    },
  },
  Route: {
    __resolveType: () => 'Route',
    pathname: async ({ __typename, id }, args, { dataSources: { ContentItem } }) => {
      switch (__typename) {
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
