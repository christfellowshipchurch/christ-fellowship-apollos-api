const resolver = {
  Query: {
    metadata: async (root, { relatedNode }, { dataSources }) =>
      dataSources.Metadata.getByRelatedNode(relatedNode),
  },
}

export default resolver
