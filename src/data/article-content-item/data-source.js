import { ContentChannel } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
    get
} from 'lodash'

const { ROCK_MAPPINGS } = ApollosConfig

export default class ArticleContentItem extends ContentChannel.dataSource {
    expanded = true

    getArticleContentItemByTitle = async (title) => {
        // Get the Article Content Channels for the specified Title
        const websiteContentChannelId = get(
            ROCK_MAPPINGS,
            `CONTENT_CHANNEL_TYPE_IDS.${title}`,
            null)

        if (websiteContentChannelId) {
            return await this.request()
                .filter(`Id eq ${websiteContentChannelId}`)
                .first()
        }

        return null
    }

}
