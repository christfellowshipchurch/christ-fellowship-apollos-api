import ApollosConfig from '@apollosproject/config';
import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock';
import { get } from 'lodash';

import { parseRockKeyValuePairs } from '../utils';

import sanitizeHtml from '../sanitize-html';

const resolver = {
  InformationalContentItem: {
    ...coreContentItem.resolver.ContentItem,
    redirectUrl: ({ attributeValues }) => get(attributeValues, 'redirectUrl.value', ''),
    callsToAction: async ({ attributeValues }, args, { dataSources }) => {
      // Deprecated Content Channel Type
      const ctaValuePairs = parseRockKeyValuePairs(
        get(attributeValues, 'callsToAction.value', ''),
        'call',
        'action'
      );

      if (ctaValuePairs.length) return ctaValuePairs;

      // Get Matrix Items
      const { MatrixItem } = dataSources;
      const matrixGuid = get(attributeValues, 'actions.value', '');
      const matrixItems = await MatrixItem.getItemsFromId(matrixGuid);

      return matrixItems.map(({ attributeValues: matrixItemAttributeValues }) => ({
        call: get(matrixItemAttributeValues, 'title.value', ''),
        action: get(matrixItemAttributeValues, 'url.value', ''),
      }));
    },
    htmlContent: ({ content }) => sanitizeHtml(content),
    sharing: (root, args, { dataSources: { ContentItem } }, { parentType }) => ({
      url: ContentItem.generateShareUrl(root, parentType),
      title: 'Share via ...',
      message: ContentItem.generateShareMessage(root),
    }),
  },
};

export default resolver;
