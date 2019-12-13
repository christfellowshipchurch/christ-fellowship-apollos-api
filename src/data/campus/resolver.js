import {
  Campus as coreCampus,
  Utils
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import { get, remove } from 'lodash'
import moment from 'moment'
import { parseRockKeyValuePairs } from '../utils'
import sanitizeHtml from '@apollosproject/data-connector-rock/lib/sanitize-html'

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
    serviceTimes: async ({ serviceTimes, attributeValues }, args, { dataSources }) => {
      const serviceSchedule = get(attributeValues, 'serviceSchedule.value', null)

      if (serviceSchedule && serviceSchedule !== '') {
        const schedule = await dataSources.Campus.getSchedule(serviceSchedule)
        const { friendlyScheduleText } = schedule
        const timesParsedFromHtml = friendlyScheduleText
          .match(/<li>(.*?)<\/li>/g)
          .map((n) => n.replace(/<\/?li>/g, ''))

        return timesParsedFromHtml.map((n) => {
          const m = moment(n)

          return {
            day: m.format('YYYY-MM-DD'),
            time: m.format('LT')
          }
        })
      }

      return parseRockKeyValuePairs(serviceTimes, 'day', 'time')
    },
    campusFeatures: ({ attributeValues }, args, { dataSources }) => {
      const featureGuidsStr = get(attributeValues, 'atThisLocation.value', '')
      const featureGuidsArr = remove(featureGuidsStr.split(','), n => n !== '')

      return Promise.all(featureGuidsArr.map(async n => {
        const { value, attributeValues } = await dataSources.DefinedValue.getByIdentifier(n)
        const subtitle = get(attributeValues, 'subtitle.value', '')
        const content = get(attributeValues, 'content.value', '')
        const icon = get(attributeValues, 'icon.value', '')

        return {
          title: value,
          summary: dataSources.ContentItem.createSummary({
            attributeValues: { summary: { value: subtitle } },
            content
          }),
          htmlContent: sanitizeHtml(content),
          options: remove(get(attributeValues, 'options.value', '').split('|'), n => n !== ''),
          icon,
        }
      }))
    },
  },
  Query: {
    campus: (root, { name }, { dataSources }) => dataSources.Campus.getByName(name)
  }
}

export default resolverMerge(resolver, coreCampus)
