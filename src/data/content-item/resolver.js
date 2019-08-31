import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
  ContentItem: {

  }
}

export default resolverMerge(resolver, coreContentItem)
