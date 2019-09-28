import { ContentItem } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
    get, find, kebabCase, toLower
} from 'lodash'

const { ROCK_MAPPINGS } = ApollosConfig

export default class ArticleContentItem extends ContentItem.dataSource {
    expanded = true

    formatArticleTitleAsUrl = (title) => kebabCase(toLower(title))

    getArticles = async () => {
        const contentChannelTypes = get(ROCK_MAPPINGS, 'CONTENT_ITEM.ArticleContentItem.ContentChannelTypeId', [])

        const contentChannelTypeFilters = contentChannelTypes.map((n, i) =>
            `ContentChannelTypeId eq ${n}`)

        const articles = await this.request()
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

}
