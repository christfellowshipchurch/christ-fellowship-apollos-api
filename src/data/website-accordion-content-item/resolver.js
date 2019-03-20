import { ContentItem } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';

const resolver = {
    WebsiteAccordionContentItem: {
        ...ContentItem.resolver.ContentItem,
    }
}

export default schemaMerge(resolver, ContentItem)
