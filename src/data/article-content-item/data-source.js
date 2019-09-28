import { ContentItem } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
    get, find, kebabCase, toLower
} from 'lodash'

const { ROCK_MAPPINGS } = ApollosConfig

export default class ArticleContentItem extends ContentItem.dataSource {
    expanded = true

    formatArticleTitleAsUrl = (title) => kebabCase(toLower(title))

    getArticles = async (props) => {
        const first = get(props, 'first', 0)

        const contentChannelTypes = get(ROCK_MAPPINGS, 'CONTENT_ITEM.ArticleContentItem.ContentChannelTypeId', [])

        const contentChannelTypeFilters = contentChannelTypes.map((n, i) =>
            `ContentChannelTypeId eq ${n}`)

        const articles = first && first > 0
            ? await this.request()
                .filterOneOf(contentChannelTypeFilters)
                .top(first)
                .get()
            : await this.request()
                .filterOneOf(contentChannelTypeFilters)
                .get()

        return articles
    }


    // title pattern should follow: the-article-title
    getArticleContentItemByTitle = async (title) => {
        const articles = await this.getArticles()

        return find(articles, (n) =>
            this.formatArticleTitleAsUrl(get(n, 'title', '')) === this.formatArticleTitleAsUrl(title)
        )
    }

    getCategories = async (id) => {
        const parentAssociations = await this.request(
            'ContentChannelItemAssociations'
        )
            .filter(`ChildContentChannelItemId eq ${id}`)
            .get()

        if (!parentAssociations || !parentAssociations.length) return null

        return parentAssociations.map(async ({ contentChannelItemId }) => {
            const { title } = await this.context.dataSources.ContentItem.getFromId(contentChannelItemId)

            return title
        })
    }
}
