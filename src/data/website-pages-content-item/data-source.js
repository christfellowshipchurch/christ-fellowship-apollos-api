import { ContentItem, ContentChannel } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import {
    get, lowerCase, first
} from 'lodash';

const { ROCK_MAPPINGS } = ApollosConfig;

const normalizeWebPageTitle = (title) => lowerCase(title).replace(/\s/g, '');

export default class WebsitePagesContentItem extends ContentItem.dataSource {
    getWebsitePageContentByTitle = async (website, title) => {
        console.log("Running getWebsitePageContentByTitle...");

        // Get the Content Channels for the specified Website
        const websiteContentChannelIds = get(
            ROCK_MAPPINGS,
            `WEBSITE_CONTENT_CHANNEL_IDS.${website}`,
            null);

        console.log({ websiteContentChannelIds });

        if (websiteContentChannelIds) {
            // Get the Content Channel Items from Content Channel Id
            const websiteContentChannelItems = await this.request()
                .filter(websiteContentChannelIds.map(
                    (channelId) => `(ContentChannelId eq ${channelId})`
                ).join(' or '))
                .get();

            if (websiteContentChannelItems) {
                // Find top 1 page whose 
                const contentItem = first(
                    websiteContentChannelItems.filter(
                        (item) => normalizeWebPageTitle(get(item, 'title', '')) === normalizeWebPageTitle(title)
                    )
                );

                console.log({ contentItem });

                return contentItem;
            }
        }

        return null;
    }
}