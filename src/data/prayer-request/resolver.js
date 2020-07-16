import { PrayerRequest as corePrayerRequest } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
}

export default resolverMerge(resolver, corePrayerRequest)
