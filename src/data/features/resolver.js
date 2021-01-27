import { Feature as coreFeatures } from '@apollosproject/data-connector-rock';
import { resolverMerge, createGlobalId } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';

const { ROCK_MAPPINGS } = ApollosConfig;

const resolver = {
  ActionBarFeature: {
    id: ({ id }) => createGlobalId(id, 'ActionBarFeature'),
  },
  AvatarListFeature: {
    id: ({ id }) => createGlobalId(id, 'AvatarListFeature'),
  },
  LiveStreamListFeature: {
    id: ({ id }) => createGlobalId(id, 'LiveStreamListFeature'),
  },
};

export default resolverMerge(resolver, coreFeatures);
