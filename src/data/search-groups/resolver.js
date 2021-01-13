// import * as coreSearch from '@apollosproject/data-connector-algolia-search'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'

const { ROCK } = ApollosConfig

const resolver = {
  SearchResultItem: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type)
  },
  Query: {
    searchGroups: (root, args, { dataSources }) => {
      console.log('Resolving >> searchGroups');

      return null;
    }
  }
}

export default resolver;