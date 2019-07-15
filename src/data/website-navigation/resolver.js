import {
    createGlobalId,
} from '@apollosproject/server-core';
import {
    get, first
} from 'lodash'

import { parseRockKeyValuePairs } from '../utils'

const resolver = {
    Query: {
        getWebsiteNavigation: async (root, { website }, context) =>
            await context.dataSources.WebsiteNavigation.getWebsiteNavigation(website),
    },
    WebsiteNavigation: {
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
        navigationLinks: ({ attributeValues }) => (
            parseRockKeyValuePairs(
                get(attributeValues, 'navigationLinks.value', ''),
                'call',
                'action')
        ),
        quickAction: ({ attributeValues }) => (
            first(parseRockKeyValuePairs(
                get(attributeValues, 'quickAction.value', ''),
                'call',
                'action'))
        ),
        images: (root, args, { dataSources: { ContentItem } }) =>
            ContentItem.getImages(root),

        instagramUrl: ({ attributeValues }) => (
            get(attributeValues, 'instagramUrl.value', null)
        ),
        twitterUrl: ({ attributeValues }) => (
            get(attributeValues, 'twitterUrl.value', null)
        ),
        facebookUrl: ({ attributeValues }) => (
            get(attributeValues, 'facebookUrl.value', null)
        ),
        footerLinks: ({ attributeValues }) => (
            parseRockKeyValuePairs(
                get(attributeValues, 'footerLinks.value', ''),
                'call',
                'action')
        )
    }
}

export default resolver
