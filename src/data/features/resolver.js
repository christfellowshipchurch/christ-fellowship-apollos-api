import { Feature as coreFeatures } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'

const { ROCK_MAPPINGS } = ApollosConfig

const resolver = {
    Query: {
        // 5.0.x and 5.1.x use a different client side UI set that is not compatible
        // with Core Apollos 1.4.3. In order to combat that, we check the version of the client
        // coming in to route requests
        //
        // TODO : deprecate this once we get at least 80-90% adpotion of the new version
        userFeedFeatures: async (root, args, { clientVersion, dataSources: { Feature } }) => {
            const seriesContentChannelConfig = {
                algorithms: [{
                    type: "CONTENT_CHANNEL",
                    arguments: {
                        contentChannelId: 73
                    }
                }],
                type: "VerticalCardListFeature",
                title: "Series"
            }
            const seriesFeatureConfig = {
                algorithms: ["SERIES_IN_PROGRESS"],
                type: "HorizontalCardList",
                title: "Up next for you"
            }

            const seriesChannelFeature = await Feature.createVerticalCardListFeature(seriesContentChannelConfig)
            const upNextFeature = await Feature.createHorizontalCardListFeature(seriesFeatureConfig)

            const rockFeed = await Feature.getRockFeedFeatures({
                contentChannelId: ROCK_MAPPINGS.HOME_FEATURES_CHANNEL_ID
            })

            return clientVersion && (clientVersion.startsWith("5.0") || clientVersion.startsWith("5.1") || clientVersion.startsWith("web-1."))
                ? Feature.getHomeFeedFeatures()
                : [
                    seriesChannelFeature,
                    upNextFeature,
                    ...rockFeed
                ]
        },
        userHeaderFeatures: async (root, args, { dataSources: { Feature, Flag } }) => {
            const status = await Flag.currentUserCanUseFeature("HOME_HEADER")

            if (status === "LIVE") {
                return Feature.getHomeHeaderFeedFeatures()
            }

            return []
        }
    }
}

export default resolverMerge(resolver, coreFeatures)
