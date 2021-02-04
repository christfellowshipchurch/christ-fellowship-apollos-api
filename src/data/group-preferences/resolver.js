import ApollosConfig from '@apollosproject/config';

const resolver = {
  Query: {
    allPreferences: async (root, args, { dataSources }) =>
      dataSources.Preferences.getGroupPreferences(),
    allSubPreferences: async (root, args, { dataSources }) =>
      dataSources.Preferences.getGroupSubPreferences(),
  },
};

export default resolver;
