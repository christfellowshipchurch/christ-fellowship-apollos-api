import { ContentItem } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';
import { isType, isRequired } from '../utils';

export default class PageBuilder extends ContentItem.dataSource {
  async getFeatures(pathname) {
    const { ContentItem, Feature } = this.context.dataSources;

    const contentItemId = await this.getIdByUrl(pathname);

    if (contentItemId) {
      const childrenIds = await ContentItem.getChildrenIds(contentItemId);
      const children = await Promise.all(childrenIds.map((id) => this.getFromId(id)));

      return children.map((child) => {
        const { id, contentChannelId } = child;

        if (contentChannelId === 87) {
          return Feature.createVerticalCardListFeature({
            algorithms: [
              {
                type: 'CONTENT_CHILDREN',
                arguments: {
                  contentChannelItemId: id,
                  limit: 0,
                },
              },
            ],
            title,
            subtitle: this.createSummary(child),
          });
        }

        return Feature.createContentBlockFeature({ contentChannelItemId });
      });
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
            .andFilter(
              contentChannelIds
                .map((contentChannelId) => `(ContentChannelId eq ${contentChannelId})`)
                .join(' or ')
            )
            .select('Id')
            .first();

          return contentItem && Number.isInteger(contentItem.id) ? contentItem.id : null;
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
