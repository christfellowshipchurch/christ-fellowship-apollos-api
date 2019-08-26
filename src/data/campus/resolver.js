import {
  Campus as coreCampus,
  Utils
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import { has, get } from 'lodash'

const { createImageUrlFromGuid } = Utils

const resolver = {
  Campus: {
    // image: ({ attributeValues }) => ({
    //   uri: get(attributeValues, 'squareImageUrl.value', null)
    // }),
    image: async ({ id }, args, { dataSources }) => {
      const { attributeValues } = await dataSources.Campus.getFromId(id)

      return ({
        uri: get(attributeValues, 'campusImage.value', null) ? createImageUrlFromGuid(attributeValues.featuredImage.value) : null,
      })
    },
    featuredImage: async ({ id }, args, { dataSources }) => {
      const { attributeValues } = await dataSources.Campus.getFromId(id)

      return ({
        uri: get(attributeValues, 'featuredImage.value', null) ? createImageUrlFromGuid(attributeValues.featuredImage.value) : null,
      })
    },
  }
}

export default resolverMerge(resolver, coreCampus)
