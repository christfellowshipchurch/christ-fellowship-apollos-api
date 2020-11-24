import { createGlobalId } from '@apollosproject/server-core';

const resolver = {
  Url: {
    id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
  },
};

export default resolver;
