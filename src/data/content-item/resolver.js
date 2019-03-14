import { ContentItem } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';

const resolver = {
    ContentItem: {
        __resolveType: async (attrs, ...otherProps) => {
            if (Object.hasOwnProperty.call(attrs.attributeValues, 'price')) {
                return 'WebsitePagesContentItem';
            }

            return ContentItem.resolver.ContentItem.__resolveType(
                attrs,
                ...otherProps
            );
        },
    }
}

export default schemaMerge(resolver, ContentItem);