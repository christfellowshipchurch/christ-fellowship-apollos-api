const resolver = {
    Query: {
        flagStatus: (root, { key }, { dataSources }) =>
            dataSources.Flag.currentUserCanUseFeature(key)
    }
}

export default resolver
