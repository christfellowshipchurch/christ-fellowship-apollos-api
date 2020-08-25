import { get } from 'lodash';
import { Utils } from '@apollosproject/data-connector-rock'
const { createImageUrlFromGuid } = Utils
import { parseRockKeyValuePairs } from '../utils'

export default {
    PageBuilderFeature: {
        // Implementors must attach __typename to root.
        __resolveType: ({ __typename }) => __typename,
    },
    ContentBlockItem: {
        htmlContent: ({ content }) => content,
        image: ({ image }) => {
        if(typeof image === 'string'){
            return ({ sources: !!image && image !== ''
                ? [{ uri: createImageUrlFromGuid(image) }]
                : [] })
            }
         return image
        },
    },
    Query: {
        pageBuilderFeatures: (root, { url }, { dataSources: { PageBuilder } }) =>
            PageBuilder.buildForUrl(url),
    },
}
