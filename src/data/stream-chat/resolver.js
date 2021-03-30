import { createGlobalId } from '@apollosproject/server-core';
import crypto from 'crypto-js';

const resolver = {
  StreamChatChannelNode: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type),
  },
  StreamChatChannel: {
    id: ({ channelId, channelType }, args, context, { parentType }) =>
      createGlobalId(JSON.stringify({ channelId, channelType }), parentType.name),
  },
  StreamChatChannelType: {
    LIVESTREAM: () => 'livestream',
    MESSAGING: () => 'messaging',
    GROUP: () => 'group',
  },
};

export default resolver;
