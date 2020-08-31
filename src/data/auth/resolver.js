import { Auth as coreAuth } from '@apollosproject/data-connector-rock'
import { get } from 'lodash';
import ApollosConfig from '@apollosproject/config'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
    Mutation: {
        requestEmailLoginPin: (root, args, { dataSources }) =>
            dataSources.Auth.requestEmailPin(args),
        changePasswordWithPin: (root, { email, pin, newPassword }, { dataSources }) =>
            dataSources.Auth.changePasswordWithPin({ email, pin, newPassword }),
    },
    AuthenticatedUser: {
        streamChatToken: async ({ id }, args, { dataSources }) => {
            const { Auth, Flag, StreamChat } = dataSources;
            const featureFlagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT');

            if (featureFlagStatus !== 'LIVE') {
                return null;
            }

            return StreamChat.generateUserToken(id);
        },
        streamChatRole: async ({ id }, args, { dataSources }) => {
            const { Auth, StreamChat } = dataSources;

            const flag = get(ApollosConfig, 'FEATURE_FLAGS.LIVE_STREAM_CHAT', null)
            if (flag && flag.status === "LIVE") {
                if (flag.securityGroupId) {
                    if (await Auth.isInSecurityGroup(flag.securityGroupId)) {
                      await StreamChat.addModerator(id);
                      return 'MODERATOR';
                    }
                }
            }

            return 'USER';
        },
    },
    Query: {
        canAccessExperimentalFeatures: async (root, args, { dataSources }) =>
            dataSources.Auth.isInSecurityGroup(ApollosConfig.ROCK_MAPPINGS.SECURITY_GROUPS.EXPERIMENTAL_FEATURES),
    }
}

export default resolverMerge(resolver, coreAuth)
