import { Auth as coreAuth } from '@apollosproject/data-connector-rock'
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
      const { Flag, StreamChat } = dataSources;
      const featureFlagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT');

      if (featureFlagStatus !== 'LIVE') {
        return null;
      }

      return StreamChat.generateUserToken(id);
    },
    streamChatRole: async ({ id: userId }, { id: channelId }, { dataSources }) => {
      const { Flag, StreamChat } = dataSources;
      const featureFlagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT');

      if (featureFlagStatus !== 'LIVE') {
        return null;
      }

      if (await StreamChat.currentUserIsGlobalModerator()) {
        await StreamChat.addModerator({ channelId, userId });
        return 'MODERATOR';
      }

      await StreamChat.removeModerator({ channelId, userId });
      return 'USER';
    },
  },
  Query: {
    canAccessExperimentalFeatures: async (root, args, { dataSources }) =>
      dataSources.Auth.isInSecurityGroup(ApollosConfig.ROCK_MAPPINGS.SECURITY_GROUPS.EXPERIMENTAL_FEATURES),
  }
}

export default resolverMerge(resolver, coreAuth)
