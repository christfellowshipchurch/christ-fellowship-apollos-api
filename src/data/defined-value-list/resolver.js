import { createGlobalId } from '@apollosproject/server-core'

const resolver = {
    Query: {
        getDefinedValueByIdentifier: (root, { identifier }, { dataSources }) => dataSources.DefinedValueList.getByIdentifier(identifier)
    },
    DefinedValueList: {
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
        values: ({ definedValues }, args, { dataSources }) => definedValues,
    }
}

export default resolver
