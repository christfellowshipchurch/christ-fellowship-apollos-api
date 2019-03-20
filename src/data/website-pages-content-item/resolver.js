import { ContentItem } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';

const resolver = {
    Query: {
        getWebsitePageContentByTitle: async (root, { website, title }, context) =>
            await context.dataSources.WebsitePagesContentItem.getWebsitePageContentByTitle(website, title),
    },
    WebsitePagesContentItem: {
        ...ContentItem.resolver.ContentItem,
    }
}

export default schemaMerge(resolver, ContentItem)
