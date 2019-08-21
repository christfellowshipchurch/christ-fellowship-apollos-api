import {
  Campus as coreCampus,
  Utils
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import { has, get } from 'lodash'

const { createImageUrlFromGuid } = Utils

const resolver = {
  Campus: {
    image: ({ attributeValues }) => ({
      uri: get(attributeValues, 'squareImageUrl.value', null)
    }),
    featuredImage: async ({ id }, args, { dataSources }) => {
      const { attributeValues } = await dataSources.Campus.getFromId(id)
      return ({
        uri: has(attributeValues, 'featuredImage.value') ? createImageUrlFromGuid(attributeValues.featuredImage.value) : null,
        width: 0,
        height: 0
      })
    },
  }
}

export default resolverMerge(resolver, coreCampus)
