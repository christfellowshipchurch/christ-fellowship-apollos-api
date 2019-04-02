import { ContentItem } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';
import {
    get
} from 'lodash'

const parseProtocols = (str) => str
    ? str.split('|')
        .map((n) => {
            var splt = n.split('^')
            return { content: splt[0] || '', name: splt[1] || '' };
        })
    : []

const resolver = {
    Query: {
        getWebsitePageContentByTitle: async (root, { website, title }, context) =>
            await context.dataSources.WebsitePagesContentItem.getWebsitePageContentByTitle(website, title),
    },
    WebsitePagesContentItem: {
        ...ContentItem.resolver.ContentItem,
        metaDescription: async ({ attributeValues }) =>
            get(attributeValues, 'metaDescription.value', ''),
        metaKeywords: async ({ attributeValues }) =>
            get(attributeValues, 'metaKeywords.value', [])
                .split('|')
                .filter((n) => {
                    return n !== '';
                }),
        openGraphProtocols: ({ attributeValues }) =>
            parseProtocols(get(attributeValues, 'openGraphProtocols.value', null)),
        twitterProtocols: ({ attributeValues }) =>
            parseProtocols(get(attributeValues, 'twitterProtocols.value', null)),
    }
}

export default schemaMerge(resolver, ContentItem)
