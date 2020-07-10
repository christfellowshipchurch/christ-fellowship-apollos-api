import { Feature as coreFeatures } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'


const resolver = {
    Query: {
        userHeaderFeatures: (root, args, { dataSources: { Feature } }) => {
            console.log("QUERY")
            return Feature.getHomeHeaderFeedFeatures()
        }
    }
}

export default resolverMerge(resolver, coreFeatures)
