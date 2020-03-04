import { ContentItem } from '@apollosproject/data-connector-rock'
import {
    get, camelCase
} from 'lodash'
import {
    parseRockKeyValuePairs
} from '../utils'

const resolver = {
    WebsiteFeature: {
        ...ContentItem.resolver.ContentItem,
        feature: ({ attributeValues }, args, context) => get(attributeValues, 'feature.value', ''),
        subtitle: ({ attributeValues }) => get(attributeValues, 'subtitle.value', null)
    }
}

export default resolver