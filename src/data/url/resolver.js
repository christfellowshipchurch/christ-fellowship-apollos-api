import { createGlobalId } from '@apollosproject/server-core';

const resolver = {
    Url: {
        id: ({ url }, args, context, { parentType }) =>
            createGlobalId(url, parentType.name),
    },
}

export default resolver
