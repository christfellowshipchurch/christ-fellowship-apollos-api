import ApollosConfig from '@apollosproject/config';

const resolver = {
  Query: {
    allPreferences: async (root, args, { dataSources }) =>
      dataSources.GroupPreferences.getGroupPreferences(),
    allSubPreferences: async (root, args, { dataSources }) =>
      dataSources.GroupPreferences.getGroupSubPreferences(),
  },
};

export default resolver;
