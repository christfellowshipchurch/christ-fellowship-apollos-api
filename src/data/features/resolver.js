import { Feature as coreFeatures } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'

const { ROCK_MAPPINGS } = ApollosConfig

const resolver = {
    Query: {
        connectFeedFeatures: async (root, args, { dataSources: { Feature } }) =>
            Feature.getConnectFeedFeatures(),
        eventsFeedFeatures: async (root, args, { dataSources: { Feature } }) =>
            Feature.getEventsFeedFeatures(),
        giveFeedFeatures: async (root, args, { dataSources: { Feature } }) =>
            Feature.getGiveFeedFeatures(),
        userHeaderFeatures: async (root, args, { dataSources: { Feature, Flag } }) => {
            const status = await Flag.currentUserCanUseFeature("HOME_HEADER")

            if (status === "LIVE") {
                return Feature.getHomeHeaderFeedFeatures()
            }

            return []
        },
        userFeedFeatures: async (root, args, { clientVersion, dataSources: { Feature } }) => {
            // 5.0.x and 5.1.x use a different client side UI set that is not compatible
            // with Core Apollos 1.4.3. In order to combat that, we check the version of the client
            // coming in to route requests
            //
            // TODO : deprecate this once we get at least 80-90% adpotion of the new version
            return clientVersion && (clientVersion.startsWith("5.0") || clientVersion.startsWith("5.1") || clientVersion.startsWith("web-1."))
                ? Feature.getHomeFeedFeatures()
                : Feature.getRockFeedFeatures({
                    contentChannelId: ROCK_MAPPINGS.HOME_FEATURES_CHANNEL_ID
                })
        },
    }
}

export default resolverMerge(resolver, coreFeatures)
