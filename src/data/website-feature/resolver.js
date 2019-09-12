import { ContentItem } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import {
    get, camelCase
} from 'lodash'

const resolver = {
    WebsiteFeature: {
        ...ContentItem.resolver.ContentItem,
        feature: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'feature.value', '')
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid)

            return camelCase(get(definedValue, 'value', ''))
        },
    }
}

export default resolverMerge(resolver, ContentItem)
