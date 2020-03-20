import ApollosConfig from '@apollosproject/config'
import {
  ContentItem as coreContentItem,
} from '@apollosproject/data-connector-rock'
import {
  get,
} from 'lodash'
import moment from 'moment'
import momentTz from 'moment-timezone'

import { parseRockKeyValuePairs } from '../utils'

const resolver = {
  InformationalContentItem: {
    ...coreContentItem.resolver.ContentItem,
    redirectUrl: ({ attributeValues }) => get(attributeValues, 'redirectUrl.value', '')
  },
}

export default resolver
