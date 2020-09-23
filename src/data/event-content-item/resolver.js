import {
  ContentItem as coreContentItem,
} from '@apollosproject/data-connector-rock'
import {
  get,
  flatten,
  uniq,
  first
} from 'lodash'
import moment from 'moment'
import momentTz from 'moment-timezone'

import sanitizeHtml from '../sanitize-html'
import { sharingResolver } from '../content-item/resolver'
import deprecatedResolvers from './deprecated-resolvers'

const resolver = {
  EventContentItem: {
    ...coreContentItem.resolver.ContentItem,
    ...sharingResolver,
    ...deprecatedResolvers,
    htmlContent: ({ content }) => sanitizeHtml(content),
    sharing: (root, args, { dataSources: { ContentItem } }, { parentType }) => ({
      url: ContentItem.generateShareUrl(root, parentType),
      title: 'Share via ...',
      message: ContentItem.generateShareMessage(root),
    }),
    checkin: ({ id }, args, { dataSources: { CheckInable } }, { parentType }) =>
      CheckInable.getByContentItem(id),
    label: async ({ attributeValues }, args, { dataSources: { MatrixItem, Event, Schedule } }) => {
      // Get Matrix Items
      const matrixGuid = get(attributeValues, 'schedules.value', '')
      const matrixItems = await MatrixItem.getItemsFromId(matrixGuid)

      // Get Schedules
      const schedules = await Schedule.getFromIds(
        uniq(matrixItems.map(m => get(item, 'attributeValues.schedule.value', '')))
      )

      // Sort by start date asc, take the first
      const eventStart = first(schedules.sort((a, b) => moment(a.effectiveStartDate).diff(b.effectiveStartDate)))

      // Sort by end date desc, take the first
      const eventEnd = first(schedules.sort((a, b) => moment(b.effectiveEndDate).diff(a.effectiveEndDate)))

      return ""
    },
    eventGroupings: async ({ attributeValues }, args, { dataSources: { MatrixItem, Event, Schedule } }) => {
      // Get Matrix Items
      const matrixGuid = get(attributeValues, 'schedules.value', '')
      let matrixItems = []

      if (!matrixGuid || matrixGuid === "") return []

      try {
        matrixItems = await MatrixItem.getItemsFromId(matrixGuid)
      } catch (e) {
        console.log({ e })
        return []
      }

      /**
       * Matrix Items are structured in Rock as: { schedule, [filters] }
       * We need to invert that relationship to be: { filter: [schedules] }
       */
      const filterScheduleDictionary = {}
      matrixItems.forEach(item => {
        const schedule = get(item, 'attributeValues.schedule.value', '')
        const filters = get(item, 'attributeValues.filters.value', '')

        filters.split(',').forEach(filter => {
          if (filterScheduleDictionary[filter]) {
            filterScheduleDictionary[filter].push(schedule)
          } else {
            filterScheduleDictionary[filter] = [schedule]
          }
        })
      })

      return Object.entries(filterScheduleDictionary).map(([name, schedules]) => {
        return {
          name,
          instances: async () => {
            const rockSchedules = await Schedule.getFromIds(schedules)
            const times = await Promise.all(rockSchedules.map(s => Event.parseScheduleAsEvents(s)))

            return flatten(times)
              .sort((a, b) => moment(a.start).diff(b.start))
          }
        }
      })
    }
  },
}

export default resolver
