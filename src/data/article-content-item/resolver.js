import { ContentItem, Utils } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import {
    get, has
} from 'lodash'
import { parseRockKeyValuePairs, parseHexCode } from '../utils'

const { createImageUrlFromGuid } = Utils
const createVideoUrlFromGuid = (uri) =>
    uri.split('-').length === 5
        ? `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`
        : Utils.enforceProtocol(uri);

const resolver = {
    Query: {
        getArticles: (root, { title }, context) =>
            context.dataSources.ArticleContentItem.getArticles(),
        getArticleByTitle: async (root, { title }, context) =>
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
        summary: ({ attributeValues }) => get(attributeValues, 'subtitle.value', null),
        author: async ({ attributeValues }, args, { dataSources }) => {
            if (has(attributeValues, 'author.value')) {
                const { id } = await dataSources.Person.getFromAliasId(attributeValues.author.value)

                const person = await dataSources.Person.getFromId(id)

                return {
                    ...person,
                    photo: {
                        url: createImageUrlFromGuid(get(person, 'photo.guid', ''))
                    }
                }
            }

            return null
        },
        readTime: ({ attributeValues }) => get(attributeValues, 'estimatedReadTime.value', null),
    }
}

export default resolverMerge(resolver, ContentItem)
