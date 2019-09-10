import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
  ContentItem: {
    images: (root, args, { dataSources: { ContentItem } }) => {
      const images = ContentItem.getImages(root)

      if (images.length) return images

      return [{ sources: [{ uri: 'https://picsum.photos/640/640/?random' }] }]
    }
  }
}

export default resolverMerge(resolver, coreContentItem)
