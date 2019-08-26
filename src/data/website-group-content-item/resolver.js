import { ContentItem, Utils } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import {
    get, lowerCase
} from 'lodash'
import { parseHexCode } from '../utils'

const createVideoUrlFromGuid = (uri) =>
    uri.split('-').length === 5
        ? `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`
        : Utils.enforceProtocol(uri);

const resolver = {
    WebsiteGroupItem: {
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
        groupLayout: async ({ attributeValues }, args, { dataSources }) => {
            const layoutId = get(attributeValues, 'groupLayout.value', null)

            if (layoutId) {
                const definedValue = await dataSources.DefinedValue.getDefinedValueByIdentifier(layoutId)

                return get(definedValue, 'value', null)
            }

            return null
        },
        accordionType: async ({ attributeValues }, args, { dataSources }) => {
            const typeId = get(attributeValues, 'accordionType.value', '')
            const definedValue = await dataSources.DefinedValue.getDefinedValueByIdentifier(typeId)

            return get(definedValue, 'value', null)
        },
        backgroundColor: ({ attributeValues }) => {
            const value = get(attributeValues, 'backgroundColor.value', null)

            return value ? parseHexCode(value) : null
        }
    }
}

export default resolverMerge(resolver, ContentItem)
