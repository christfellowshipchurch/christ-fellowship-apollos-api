import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

const resolver = {
    Query: {
        flagStatus: async (root, { key }, { dataSources }) => {
            const flag = get(ApollosConfig, `FEATURE_FLAGS.${key}`, null)
            if (flag && flag.status === "LIVE") {
                if (flag.securityGroupId) {
                    return await dataSources.Auth.isInSecurityGroup(flag.securityGroupId)
                        ? "LIVE"
                        : "DISABLED"
                }

                return flag.status
            }

            return "DISABLED"
        },
    }
}

export default resolver
