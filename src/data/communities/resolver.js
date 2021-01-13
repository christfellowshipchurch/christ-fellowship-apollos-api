const resolver = {
  Query: {
    allCommunities: async (root, args, { dataSources }) =>
      dataSources.Communities.getCommunities(),
  },
};

export default resolver;
