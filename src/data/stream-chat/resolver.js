import { createGlobalId } from '@apollosproject/server-core';
import crypto from 'crypto-js';

const resolver = {
  StreamChatChannelNode: {
    __resolveType: ({ __typename, __type }, args, resolveInfo) =>
      __typename || resolveInfo.schema.getType(__type),
  },
  StreamChatChannel: {
    id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
  },
  StreamChatChannelType: {
    LIVESTREAM: () => 'livestream',
    MESSAGING: () => 'messaging',
    GROUP: () => 'group',
  },
};

export default resolver;
