import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
  Query: {
    getBrowseFilters: (root, args, context) =>
      context.dataSources.ContentChannel.getRootChannels(),
  }
}

export default resolver
