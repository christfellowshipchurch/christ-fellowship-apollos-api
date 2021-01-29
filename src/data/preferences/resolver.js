import ApollosConfig from '@apollosproject/config';

const resolver = {
  Query: {
    allPreferences: async (root, args, { dataSources }) =>
      dataSources.Preferences.getPreferences(),
    allSubPreferences: async (root, args, { dataSources }) =>
      dataSources.Preferences.getSubPreferences(),
  },
};

export default resolver;
