import { ContentItem, Utils } from '@apollosproject/data-connector-rock';
import { schemaMerge } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';
import {
    get
} from 'lodash';

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

        // NOTE : removes the sanitizeHtml() from the content, so Graph passes back all of the HTML that Rock is returning
        // htmlContent: ({ content }) => content,
        contentLayout: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'contentLayout.value', '');
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid);

            return definedValue.value;
        },
        imageAlt: ({ attributeValues }, args, context) => get(attributeValues, 'imageAlt.value', ''),
        imageRatio: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'imageRatio.value', '');
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid);

            return definedValue.value;
        },
        callsToAction: ({ attributeValues }, args, context) => {
            const cta = get(attributeValues, 'callsToAction.value', null);

            return cta
                ? cta.split('|')
                    .map((n) => {
                        var splt = n.split('^')
                        return { call: splt[0] || '', action: splt[1] || '' };
                    })
                : []
        },
    }
}

export default schemaMerge(resolver, ContentItem);
