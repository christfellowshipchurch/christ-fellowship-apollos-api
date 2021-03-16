import { ContentItem } from '@apollosproject/data-connector-rock';

import { getConfigurationFromUrl } from '../utils';

export default class PageBuilder extends ContentItem.dataSource {
  async getFeatures(pathname) {
    const { ContentItem } = this.context.dataSources;

    const contentItemId = await this.getIdByUrl(pathname);

    if (contentItemId) {
      const childrenIds = await ContentItem.getChildrenIds(contentItemId);
      const contentItems = await Promise.all(
        childrenIds.map((id) => ContentItem.getFromId(id))
      );

      console.log({ contentItems });
    }

    return [];
  }

  getIdByUrl(pathname = isRequired('ContentItem.getIdByUrl', 'pathname')) {
    const { Cache, ContentItem } = this.context.dataSources;

    const {
      contentChannelIds,
      queryAttribute,
      page,
      pathname: cleanedPathname,
    } = getConfigurationFromUrl(pathname);

    if (contentChannelIds) {
      const request = async () => {
        const contentItem = await ContentItem.byAttributeValue(queryAttribute, page)
          .filterOneOf(
            contentChannelIds.map(
              (contentChannelId) => `ContentChannelId eq ${contentChannelId}`
            )
          )
          .select('Id')
          .first();

        return contentItem.id;
      };

      return Cache.request(request, {
        key: Cache.KEY_TEMPLATES.pathnameId`${cleanedPathname}`,
        expiresIn: 60 * 60 * 12, // 12 hour cache
      });
    }

    return null;
  }
}
