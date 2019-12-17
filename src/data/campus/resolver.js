import {
  Campus as coreCampus,
  Utils
} from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import { resolverMerge } from '@apollosproject/server-core'
import { get, remove, lowerCase, head } from 'lodash'
import moment from 'moment'
import { parseRockKeyValuePairs } from '../utils'
import sanitizeHtml from '@apollosproject/data-connector-rock/lib/sanitize-html'

const { createImageUrlFromGuid } = Utils
const { ROCK_MAPPINGS } = ApollosConfig

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
        // Currently, Rock returns the icon as an array of icons, but
        //  we only want to return a single icon, so we'll split by the
        //  deliminator and get the very first in that array
        const icon = head(get(attributeValues, 'icon.value', '').split('|'))

        return {
          title: value,
          summary: dataSources.ContentItem.createSummary({
            attributeValues: { summary: { value: subtitle } },
            content
          }),
          htmlContent: sanitizeHtml(content),
          options: remove(get(attributeValues, 'options.value', '').split('|'), n => n !== ''),
          icon: icon !== '' ? icon : 'hand-point-right',
        }
      }))
    },
    pastor: async ({ leaderPersonAliasId }, args, { dataSources }) => {
      const person = await dataSources.Person.getFromAliasId(leaderPersonAliasId)
      const { firstName, lastName, photo: { guid } } = person

      return {
        firstName,
        lastName,
        photo: {
          uri: createImageUrlFromGuid(guid)
        },
        email: `${lowerCase(firstName)}.${lowerCase(lastName)}@christfellowship.church`
      }
    },
  },
  Query: {
    campus: (root, { name }, { dataSources }) =>
      dataSources.Campus.getByName(name),
    campusFAQ: async (root, { name }, { dataSources }) =>
      dataSources.ContentItem.byContentChannelIds(
        get(ROCK_MAPPINGS, 'CAMPUS_FAQ_CONTENT_CHANNEL_IDS', [])
      ).get(),
    campusContentItems: async (root, { name }, { dataSources }) => {
      const { attributeValues } = await dataSources.Campus.getByName(name)

      console.log({ attributeValues })

      const item = await dataSources.ContentItem.request(
        `Guid eq (guid'${get(attributeValues, 'campusPageBlockItem.value', '')}')`
      ).get()



      return [item]
    },
  }
}

export default resolverMerge(resolver, coreCampus)
