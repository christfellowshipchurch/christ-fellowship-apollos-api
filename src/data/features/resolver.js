import { Feature as coreFeatures } from '@apollosproject/data-connector-rock';
import { resolverMerge, createGlobalId } from '@apollosproject/server-core';
import { get } from 'lodash';

const resolver = {
  ActionBarFeature: {
    id: ({ id }) => createGlobalId(id, 'ActionBarFeature'),
  },
  AvatarListFeature: {
    id: ({ id }) => createGlobalId(id, 'AvatarListFeature'),
  },
  ContentBlockFeature: {
    id: ({ id }) => createGlobalId(id, 'ContentBlockFeature'),
  },
  CardListItem: {
    labelText: ({ labelText }) => labelText,
    hasAction: (root, args, { dataSources: { ContentItem } }) => {
      // todo : temporary solution to get past a really annoying error when the type isn't there
      try {
        const { __type } = root.relatedNode;

        if (__type.includes('ContentItem')) {
          return !!get(ContentItem.getVideos(root.relatedNode), '[0].sources[0]', null);
        }
      } catch (e) {}

      return false;
    },
  },
  LiveStreamListFeature: {
    id: ({ id }) => createGlobalId(id, 'LiveStreamListFeature'),
  },
};

export default resolverMerge(resolver, coreFeatures);
