const resolver = {
  Query: {
    flagStatus: (root, { key }, { dataSources }) =>
      dataSources.Flag.currentUserCanUseFeature(key),
    currentUserFlags: (root, args, { dataSources }) =>
      dataSources.Flag.getActiveKeysForCurrentUser(),
  },
};

export default resolver;
