import { ContentItem } from '@apollosproject/data-connector-rock'
import {
    get, camelCase
} from 'lodash'

const resolver = {
    WebsiteFeature: {
        ...ContentItem.resolver.ContentItem,
        feature: async ({ attributeValues }, args, context) => {
            const definedValueGuid = get(attributeValues, 'feature.value', '')
            const definedValue = await context.dataSources.DefinedValue.getDefinedValueByIdentifier(definedValueGuid)

            return camelCase(get(definedValue, 'value', ''))
        },
        subtitle: ({ attributeValues }) => get(attributeValues, 'subtitle.value', null),
        videos: (root, args, { dataSources: { ContentItem } }) => {
            const videos = ContentItem.getVideos(root);

            return videos
        },
    }
}

export default resolver