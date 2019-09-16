import {
  Campus as coreCampus,
  Utils
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import { get } from 'lodash'
import { parseRockKeyValuePairs } from '../utils'

const { createImageUrlFromGuid } = Utils

/* 
* Rock will not alaways return the expanded Location object
*
* We get around this by checking to see if the location object is null
*
* If it's null, we know that Rock just didn't expand it, so we attempt to
*    get the location object a second time by using the getFromId query
*    which explicitly tells Rock to expand location
*/

const resolver = {
  Campus: {
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
    serviceTimes: ({ serviceTimes }) => parseRockKeyValuePairs(serviceTimes, 'day', 'time'),
  }
}

export default resolverMerge(resolver, coreCampus)
