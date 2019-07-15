import { ContentItem, Utils } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import {
    get, lowerCase
} from 'lodash'
import { parseRockKeyValuePairs, parseHexCode } from '../utils'

const createVideoUrlFromGuid = (uri) =>
    uri.split('-').length === 5
        ? `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`
        : Utils.enforceProtocol(uri);

const resolver = {
    WebsiteContentItem: {
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

            return videos.map((video) => {
                video.sources = video.sources.map((sources) => {
                    sources.uri = createVideoUrlFromGuid(sources.uri)
                    return sources;
                });

                return video;
            });
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
        callsToAction: ({ attributeValues }, args, context) => {

            const cta = get(attributeValues, 'callsToAction.value', null);

            return cta
                ? parseRockKeyValuePairs(cta, 'call', 'action')
                : []
        },
        target: ({ attributeValues }, args, context) =>
            lowerCase(get(attributeValues, 'openLinksInNewTab.value', 'false')) === 'true'
                ? '_blank'
                : '',
        subtitle: ({ attributeValues }) => get(attributeValues, 'subtitle.value', null),
        buttonColor: ({ attributeValues }) => {
            const value = get(attributeValues, 'buttonColor.value', null)
            return value ? parseHexCode(value) : null
        },
        backgroundColor: ({ attributeValues }) => {
            const value = get(attributeValues, 'backgroundColor.value', null)
            return value ? parseHexCode(value) : null
        },
        gridImageLink: ({ attributeValues }) => get(attributeValues, 'gridImageLink.value', null),
        openLinksInNewTab: ({ attributeValues }) => get(attributeValues, 'openLinksInNewTab.value', null)
    }
}

export default resolverMerge(resolver, ContentItem);
