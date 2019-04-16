import { ContentItem } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';
import {
    get
} from 'lodash'
import { parseRockKeyValuePairs } from '../utils'

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
            parseRockKeyValuePairs(
                get(attributeValues, 'openGraphProtocols.value', ''),
                'content', 'name'
            ),
        twitterProtocols: ({ attributeValues }) =>
            parseRockKeyValuePairs(
                get(attributeValues, 'twitterProtocols.value', ''),
                'content', 'name'
            ),
    }
}

export default schemaMerge(resolver, ContentItem)
