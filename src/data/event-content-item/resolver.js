import ApollosConfig from '@apollosproject/config'
import {
  ContentItem as coreContentItem,
} from '@apollosproject/data-connector-rock'
import {
  get,
  has,
  split,
  flatten,
  first,
  toLower
} from 'lodash'
import moment from 'moment'
import momentTz from 'moment-timezone'

import { parseRockKeyValuePairs } from '../utils'

const resolver = {
  EventContentItem: {
    ...coreContentItem.resolver.ContentItem,
    nextOccurrence: async ({ title, attributeValues }, args, { dataSources }) => {
      const scheduleGuids = get(attributeValues, 'schedules.value', null)

      if (scheduleGuids) {
        const rockScheduleItems = await dataSources.Schedule.getFromIds(split(scheduleGuids, ','))
        const occurrences = await dataSources.Event.parseSchedulesAsEvents(rockScheduleItems)

        return get(
          occurrences.sort((a, b) => moment(a.start).diff(moment(b.start))),
          '[0].start',
          moment().toISOString()
        )
      }

      return moment().toISOString()
    },
    startDate: ({ startDateTime }) => startDateTime,
    endDate: ({ expireDateTime }) => expireDateTime,
    tags: ({ attributeValues }) =>
      split(get(attributeValues, 'tags.value', ''), ','),
    callsToAction: ({ attributeValues }, args, { dataSources }) =>
      parseRockKeyValuePairs(
        get(attributeValues, 'callsToAction.value', ''),
        'call',
        'action'),
    openLinksInNewTab: ({ attributeValues }) =>
      toLower(get(attributeValues, 'openLinksInNewTab.value', 'false')) === 'true',
    hideLabel: ({ attributeValues }) =>
      toLower(get(attributeValues, 'hideLabel.value', 'false')) === 'true',
    events: async ({ title, attributeValues }, args, { dataSources }) => {
      const scheduleGuids = get(attributeValues, 'schedules.value', null)

      if (scheduleGuids) {
        const rockScheduleItems = await dataSources.Schedule.getFromIds(split(scheduleGuids, ','))

        const occurrences = await dataSources.Event.parseSchedulesAsEvents(rockScheduleItems)

        return occurrences.sort((a, b) => moment(a.start).diff(moment(b.start)))
      }

      return []
    }
  },
}

export default resolver
