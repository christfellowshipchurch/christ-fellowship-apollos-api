import { createGlobalId } from '@apollosproject/server-core'
import crypto from 'crypto-js'

const resolver = {
  StreamChatChannelNode: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type),
  },
  StreamChatChannel: {
    id: ({ id }, args, context, { parentType }) =>
      createGlobalId(id, parentType.name),
    channelId: ({ id }, args, context, { parentType }) => {
      const globalId = createGlobalId(id, parentType.name)

      return crypto.SHA1(globalId).toString();
    }
  },
};

export default resolver;
