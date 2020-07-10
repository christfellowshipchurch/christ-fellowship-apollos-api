import { Feature as coreFeatures } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'


const resolver = {
    Query: {
        userHeaderFeatures: (root, args, { dataSources: { Feature, Flag } }) => {
            if (Flag.currentUserCanUseFeature("HOME_HEADER")) {
                return Feature.getHomeHeaderFeedFeatures()
            }

            return []
        }
    }
}

export default resolverMerge(resolver, coreFeatures)
