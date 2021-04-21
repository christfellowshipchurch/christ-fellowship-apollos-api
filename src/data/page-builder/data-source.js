import { ContentItem } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';
import { isType } from '../utils';

export default class PageBuilder extends ContentItem.dataSource {
  async getFeatures(pathname) {
    const { ContentItem, Feature } = this.context.dataSources;

    const contentItemId = await this.getIdByUrl(pathname);

    if (contentItemId) {
      const childrenIds = await ContentItem.getChildrenIds(contentItemId);
      return childrenIds.map((contentChannelItemId) =>
        Feature.createContentBlockFeature({ contentChannelItemId })
      );
    }

    return [];
  }

  getIdByPathname(
    pathname = isRequired('PageBuilder.getIdByPathname', 'pathname'),
    contentChannelIds = isRequired('PageBuilder.getIdByPathname', 'pathname')
  ) {
    if (
      isType(pathname, 'PageBuilder.getIdByPathname', 'string') &&
      Array.isArray(contentChannelIds) &&
      contentChannelIds.length > 0
    ) {
      const { Cache, ContentItem } = this.context.dataSources;

      if (contentChannelIds) {
        const request = async () => {
          const contentItem = await ContentItem.byAttributeValue('url', pathname)
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
          key: Cache.KEY_TEMPLATES.pathnameId`${pathname}`,
          expiresIn: 60 * 60 * 12, // 12 hour cache
        });
      }
    }

    return null;
  }
}
