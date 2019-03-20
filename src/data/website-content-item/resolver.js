import { ContentItem } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';
import {
    get
} from 'lodash';

const resolver = {
    WebsiteContentItem: {
        ...ContentItem.resolver.ContentItem,
        contentLayout: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'contentLayout.value', '');
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid);

            return definedValue.value;
        },
        imageAlt: ({ attributeValues }, args, context) => get(attributeValues, 'imageAlt.value', ''),
        imageRatio: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'imageRatio.value', '');
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid);

            return definedValue.value;
        },
        callsToAction: ({ attributeValues }, args, context) => {
            const cta = get(attributeValues, 'callsToAction.value', null);

            return cta
                ? cta.split('|')
                    .map((n) => {
                        var splt = n.split('^')
                        return { call: splt[0] || '', action: splt[1] || '' };
                    })
                : []
        },
    }
}

export default schemaMerge(resolver, ContentItem);
