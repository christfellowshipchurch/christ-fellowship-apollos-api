import {
  ContentChannel as coreContentChannel,
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {

}

export default resolverMerge(resolver, coreContentChannel)
