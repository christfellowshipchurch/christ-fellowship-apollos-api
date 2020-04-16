import ApollosConfig from '@apollosproject/config'
import {
  ContentItem as coreContentItem,
} from '@apollosproject/data-connector-rock'
import {
  get,
} from 'lodash'

import { parseRockKeyValuePairs } from '../utils'

import sanitizeHtml from '../sanitize-html'

const resolver = {
  InformationalContentItem: {
    ...coreContentItem.resolver.ContentItem,
    redirectUrl: ({ attributeValues }) => get(attributeValues, 'redirectUrl.value', ''),
    callsToAction: ({ attributeValues }, args, { dataSources }) =>
      parseRockKeyValuePairs(
        get(attributeValues, 'callsToAction.value', ''),
        'call',
        'action'),
    htmlContent: ({ content }) => sanitizeHtml(content),
    sharing: (root, args, { dataSources: { ContentItem } }, { parentType }) => ({
      url: ContentItem.generateShareUrl(root, parentType),
      title: 'Share via ...',
      message: ContentItem.generateShareMessage(root),
    }),
  },
}

export default resolver
