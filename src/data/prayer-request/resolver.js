import {
    PrayerRequest as corePrayerRequest
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
    Query: {
        dailyPrayers: (root, args, { dataSources }) => {
            const { Feature } = dataSources

            return Feature.createPrayerListFeature({
                algorithms: [],
                title: "",
                subtitle: "",
                isCard: false
            })
        }
    }
}

export default resolverMerge(resolver, corePrayerRequest)
