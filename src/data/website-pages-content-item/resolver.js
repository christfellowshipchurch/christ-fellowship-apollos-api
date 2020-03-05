import { ContentItem } from '@apollosproject/data-connector-rock';
import {
    get,
} from 'lodash'
import { parseRockKeyValuePairs } from '../utils'

const resolver = {
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
        icon: ({ attributeValues }, args, { dataSources }) => get(attributeValues, 'icon.value', '')
    }
}

export default resolver
