import { resolverMerge } from '@apollosproject/server-core'
import * as coreLiveStream from '@apollosproject/data-connector-church-online'

const resolver = {
  LiveStream: coreLiveStream.resolver.LiveStream
}

export default resolverMerge(resolver, coreLiveStream)
