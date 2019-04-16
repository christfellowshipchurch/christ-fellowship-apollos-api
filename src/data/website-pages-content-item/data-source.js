import { ContentItem, ContentChannel } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import {
    get, toLower, isEmpty
} from 'lodash';

const { ROCK_MAPPINGS } = ApollosConfig;

export default class WebsitePagesContentItem extends ContentItem.dataSource {
    normalizeSlug = (slug) => toLower(slug).replace(/\s/g, '');

    // query ContentChannelItemSlugs by the title passed in
    // select the first ContentChannelItemId
    getContentChannelIdByTitle = (title) => this
        .request('ContentChannelItemSlugs')
        .filter(`Slug eq '${this.normalizeSlug(title)}'`)
        .select('ContentChannelItemId, Slug')
        .first();

    getWebsitePageContentByTitle = async (website, title) => {
        // query ContentChannelItemSlugs by the title passed in
        // select the ContentChannelItemId
        // const contentChannelItemIds = await this
        //     .request('ContentChannelItemSlugs')
        //     .filter(`Slug eq '${normalizeWebPageTitle(title)}'`)
        //     .select('ContentChannelItemId, Slug')
        //     .get();

        const contentChannelIdBySlug = await this.getContentChannelIdByTitle(title)

        // Get the Content Channels for the specified Website
        const websiteContentChannelIds = get(
            ROCK_MAPPINGS,
            `WEBSITE_CONTENT_CHANNEL_IDS.${website}`,
            null);

        if (websiteContentChannelIds && contentChannelIdBySlug) {
            // query ContentChannelItems by ContentChannelId and ContentChannelItemId
            // return the first result (we only want 1 item to be passed back since page title to page should be a 1-1 relationship)
            // const { contentChannelItemId } = first(contentChannelItemIds)
            const { contentChannelItemId } = contentChannelIdBySlug
            return await this.request()
                .filter(
                    `(${[...websiteContentChannelIds].map(
                        (channelId) => `(ContentChannelId eq ${channelId})`
                    ).join(' or ')}) and (Id eq ${contentChannelItemId})`
                )
                .first();

            // if (websiteContentChannelItems) {
            //     return first(websiteContentChannelItems);
            // }
        }

        return null;
    }
}