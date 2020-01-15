import { ContentItem } from '@apollosproject/data-connector-rock'
import {
    get, toLower, first
} from 'lodash'
import { parseRockKeyValuePairs, createVideoUrlFromGuid } from '../utils'

const resolver = {
    WebsiteBlockItem: {
        ...ContentItem.resolver.ContentItem,
        title: ({ title, attributeValues }, args, context) => {
            const titleOverride = get(attributeValues, 'titleOverride.value', '');

            return titleOverride === ''
                ? title
                : titleOverride;
        },
        htmlContent: ({ content }) => content,
        videos: (root, args, { dataSources: { ContentItem } }) => {
            const videos = ContentItem.getVideos(root);

            return videos
        },
        contentLayout: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'contentLayout.value', '');
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid);

            return definedValue.value;
        },
        imageAlt: ({ attributeValues }, args, context) => get(attributeValues, 'imageAlt.value', ''),
        imageRatio: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'imageRatio.value', '');
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid);

            return get(definedValue, 'value', '');
        },
        callToAction: ({ attributeValues }, args, context) => {
            const cta = get(attributeValues, 'callToAction.value', null)

            return cta
                ? first(parseRockKeyValuePairs(cta, 'call', 'action'))
                : null
        },
        secondaryCallToAction: ({ attributeValues }, args, context) => {
            const cta = get(attributeValues, 'secondaryCalltoAction.value', null)

            return cta
                ? first(parseRockKeyValuePairs(cta, 'call', 'action'))
                : null
        },
        openLinksInNewTab: ({ attributeValues }) =>
            toLower(get(attributeValues, 'openLinksInNewTab.value', 'false')) === 'true',
        subtitle: ({ attributeValues }) => get(attributeValues, 'subtitle.value', null),
    }
}

export default resolver