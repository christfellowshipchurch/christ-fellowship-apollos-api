import ApollosConfig from '@apollosproject/config'

const resolver = {
  SearchResultItem: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type)
  },
  Query: {
    searchGroups: (root, args, { dataSources }) => dataSources.SearchGroups.index('Groups').test()
  }
}

export default resolver;