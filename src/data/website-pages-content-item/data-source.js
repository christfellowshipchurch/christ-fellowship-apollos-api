import { ContentItem, ContentChannel } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import {
    get, lowerCase, first
} from 'lodash';

const { ROCK_MAPPINGS } = ApollosConfig;

const normalizeWebPageTitle = (title) => lowerCase(title).replace(/\s/g, '');

export default class WebsitePagesContentItem extends ContentItem.dataSource {
    getWebsitePageContentByTitle = async (website, title) => {
        // query ContentChannelItemSlugs by the title passed in
        // select the ContentChannelItemId
        const contentChannelItemIds = await this
            .request('ContentChannelItemSlugs')
            .filter(`Slug eq '${normalizeWebPageTitle(title)}'`)
            .select('ContentChannelItemId, Slug')
            .get();

        // Get the Content Channels for the specified Website
        const websiteContentChannelIds = get(
            ROCK_MAPPINGS,
            `WEBSITE_CONTENT_CHANNEL_IDS.${website}`,
            null);

        if (websiteContentChannelIds.length && contentChannelItemIds.length) {
            // query ContentChannelItems by ContentChannelId and ContentChannelItemId
            // return the first result (we only want 1 item to be passed back since page title to page should be a 1-1 relationship)
            const { contentChannelItemId } = first(contentChannelItemIds)
            const websiteContentChannelItems = await this.request()
                .filter(
                    `(${websiteContentChannelIds.map(
                        (channelId) => `(ContentChannelId eq ${channelId})`
                    ).join(' or ')}) and (Id eq ${contentChannelItemId})`
                )
                .get();

            if (websiteContentChannelItems) {
                // Find top 1 page
                return first(websiteContentChannelItems);
            }
        }

        return null;
    }
}