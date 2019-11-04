import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
  Query: {
    getBrowseFilters: (root, args, context) =>
      context.dataSources.ContentChannel.getRootChannels(),
    getBrowseCategories: (root, { filter }, context) => {
      if (filter && filter !== '') {
        return context.dataSources.Browse.getCategories(filter)
      }

      return context.dataSources.Browse.getAllCategories()
    },
    getBrowseContent: (root, { category, filter }, context) => {
      return context.dataSources.Browse.getBrowseContent({ category, filter })
    },
  }
}

export default resolver
