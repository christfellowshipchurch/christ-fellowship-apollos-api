import {
    createGlobalId,
} from '@apollosproject/server-core';
import {
    get, first, forEach
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
        footerLinks: ({ attributeValues }) => (
            parseRockKeyValuePairs(
                get(attributeValues, 'footerLinks.value', ''),
                'call',
                'action')
        ),
        socialMediaLinks: async ({ attributeValues }, args, { dataSources }) => {
            let callsToAction = parseRockKeyValuePairs(
                get(attributeValues, 'socialMediaLinks.value', ''),
                'link',
                'definedValueId')

            return callsToAction.map(async ({ definedValueId, link }) => {
                const definedValue = await dataSources.DefinedValue.getByIdentifier(definedValueId)

                return ({
                    call: get(definedValue, 'value', ''),
                    action: link
                })
            })
        }
    }
}

export default resolver
