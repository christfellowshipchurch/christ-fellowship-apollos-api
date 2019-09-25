import { ContentItem, Utils } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import {
    get
} from 'lodash'
import { parseRockKeyValuePairs, parseHexCode } from '../utils'

const createVideoUrlFromGuid = (uri) =>
    uri.split('-').length === 5
        ? `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`
        : Utils.enforceProtocol(uri);

const resolver = {
    Query: {
        getArticleContentItemByTitle: async (root, { title }, context) =>
            await context.dataSources.ArticleContentItem.getArticleContentItemByTitle(title),
    },
    ArticleContentItem: {
        ...ContentItem.resolver.ContentItem,
        title: ({ title, attributeValues }, args, context) => {
            const titleOverride = get(attributeValues, 'titleOverride.value', '');

            return titleOverride === ''
                ? title
                : titleOverride;
        },
        htmlContent: ({ content }) => content,
        subtitle: ({ attributeValues }) => get(attributeValues, 'subtitle.value', null),
    }
}

export default resolverMerge(resolver, ContentItem)
