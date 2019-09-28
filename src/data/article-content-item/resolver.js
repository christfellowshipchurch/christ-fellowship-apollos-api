import { ContentItem, Utils } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import {
    get, has
} from 'lodash'
import moment from 'moment'

const { createImageUrlFromGuid } = Utils

const resolver = {
    Query: {
        getArticles: async (root, args, { dataSources }) =>
            await dataSources.ArticleContentItem.getArticles({ first: get(args, 'first', 0) }),
        getArticleByTitle: async (root, { title }, { dataSources }) =>
            await dataSources.ArticleContentItem.getArticleContentItemByTitle(title),
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
        publishDate: ({ startDateTime }) => moment(startDateTime).toISOString(),
        categories: ({ id }, args, { dataSources }) => dataSources.ArticleContentItem.getCategories(id)
    }
}

export default resolverMerge(resolver, ContentItem)
