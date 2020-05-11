import {
    Auth as coreAuth,
} from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
    Mutation: {
        requestEmailLoginPin: (root, args, { dataSources }) =>
            dataSources.Auth.requestEmailPin(),
        changePasswordWithPin: (root, { email, pin, newPassword }, { dataSources }) =>
            dataSources.Auth.changePasswordWithPin({ email, pin, newPassword }),
    }
}

export default resolverMerge(resolver, coreAuth)
