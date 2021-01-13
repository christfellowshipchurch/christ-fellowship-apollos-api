import { withEdgePagination } from '@apollosproject/server-core';

const resolver = {
  // SearchResult: {
  //   __resolveType: ({ __typename, __type }, args, resolveInfo) => {
  //     console.log('[SearchResult] __resolveType: ', __typename || resolveInfo.schema.getType(__type));
  //     return __typename || resolveInfo.schema.getType(__type)
  //   },
  // },
  SearchResultItem: {
    __resolveType: ({ __typename, __type, indexId }, args, resolveInfo) => {
      console.log(`[SearchResultItem] from index: ${indexId}...`);

      switch (indexId) {
        case 'Groups':
          console.log('--> returning "GroupSearchResult"');
          return 'GroupSearchResult';
        case 'ContentItems':
          console.log('--> returning "ContentItemSearchResult"');
          return 'ContentItemSearchResult';
        default:
          console.log(`--> returning "${__typename || resolveInfo.schema.getType(__type)}"`);
          return __typename || resolveInfo.schema.getType(__type)
      }
    },
    node: async ({ id }, _, { models, dataSources }, resolveInfo) => {
      console.log('••••••• interface SearchResult.node resolver');
      try {
        return await models.Node.get(id, dataSources, resolveInfo);
      } catch (e) {
        // Right now we don't have a good mechanism to flush deleted items from the search index.
        // This helps make sure we don't return something unresolvable.
        console.log(`Error fetching search result ${id}`, e);
        return null;
      }
    },
  },
  SearchResultsConnection: {
    edges: (edges) => edges,
    pageInfo: (edges) => withEdgePagination({ edges }),
  }
}

export default resolver;