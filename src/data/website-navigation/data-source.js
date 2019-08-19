import { ContentChannel } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
    get
} from 'lodash'

const { ROCK_MAPPINGS } = ApollosConfig

export default class WebsiteNavigation extends ContentChannel.dataSource {
    expanded = true

    getWebsiteNavigation = async (website) => {
        console.log({ website })

        // Get the Content Channels for the specified Website
        const websiteContentChannelId = get(
            ROCK_MAPPINGS,
            `WEBSITE_CONTENT_CHANNEL_IDS.${website}`,
            null)

        console.log({ websiteContentChannelId })

        if (websiteContentChannelId) {
            return await this.request()
                .filter(`Id eq ${websiteContentChannelId}`)
                .first()
        }

        return null
    }

}
