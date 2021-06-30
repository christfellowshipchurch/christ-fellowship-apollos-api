import { withEdgePagination } from '@apollosproject/server-core';

const resolver = {
  SearchResultsConnection: {
    pageInfo: ({ edges }) => withEdgePagination({ edges }),
  },
  SearchResult: {
    node: async ({ relatedNode }, _, { models, dataSources }, resolveInfo) => {
      try {
        return models.Node.get(relatedNode.id, dataSources, resolveInfo);
      } catch (e) {
        // Right now we don't have a good mechanism to flush deleted items from the search index.
        // This helps make sure we don't return something unresolvable.
        console.log(`Error fetching search result ${relatedNode?.id}`, e);
        return null;
      }
    },
  },
};

export default resolver;
