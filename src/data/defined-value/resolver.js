import { createGlobalId } from '@apollosproject/server-core';

const resolver = {
    Query: {
        getDefinedValueByIdentifier: (root, { identifier }, { dataSources }) => dataSources.DefinedValue.getDefinedValueByIdentifier(identifier)
    },
    DefinedValue: {
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
        value: ({ value }, args, context) => value,
    }
}

export default resolver;
