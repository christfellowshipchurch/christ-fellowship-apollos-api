import { PrayerRequest as corePrayerRequest } from '@apollosproject/data-connector-rock'
import { resolverMerge, withEdgePagination } from '@apollosproject/server-core'

const resolver = {
    PrayerRequestsConnection: {
        totalCount: ({ getTotalCount }) => getTotalCount(),
        pageInfo: withEdgePagination,
    },
    Query: {
        currentUserPrayerRequests: async (root, args, { dataSources }) =>
            dataSources.PrayerRequest.paginate({
                cursor: await dataSources.PrayerRequest.byCurrentUser(),
                args,
            }),
    }
}

export default resolverMerge(resolver, corePrayerRequest)
