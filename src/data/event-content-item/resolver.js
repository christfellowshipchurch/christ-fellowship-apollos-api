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
import sanitizeHtml from '../sanitize-html'
import { sharingResolver } from '../content-item/resolver'

const resolver = {
  EventContentItem: {
    ...coreContentItem.resolver.ContentItem,
    ...sharingResolver,
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
      // If a CMS user has selected 1 or more campuses to use for this event,
      // we want to OVERRIDE any schedule attached to the event and use the 
      // campus weekend service times instead
      const campusGuids = get(attributeValues, 'weekendServices.value', null)

      if (campusGuids && campusGuids !== '') {
        // Returns an array of arrays 
        // [ [ {schedule}, {schedule}, {schedule} ], [ {schedule}, {schedule}, {schedule} ] ]
        // This means we have to flatten the array before we can pass it into the schedule
        // parser
        const campusSchedules = await Promise.all(
          split(campusGuids, ',').map(async guid => {
            const schedules = await dataSources.Campus.getServiceSchedulesById(guid)

            return schedules.map(schedule => ({
              ...schedule,
              attributeValues: {
                campuses: {
                  value: guid
                }
              }
            }))
          })
        )
        const occurrences = await dataSources.Event.parseSchedulesAsEvents(flatten(campusSchedules))

        return occurrences.sort((a, b) => moment(a.start).diff(moment(b.start)))
      } else {
        const scheduleGuids = get(attributeValues, 'schedules.value', null)
        if (scheduleGuids && scheduleGuids !== '') {
          const rockScheduleItems = await dataSources.Schedule.getFromIds(split(scheduleGuids, ','))
          const occurrences = await dataSources.Event.parseSchedulesAsEvents(rockScheduleItems)

          return occurrences.sort((a, b) => moment(a.start).diff(moment(b.start)))
        }
      }

      return []
    },
    htmlContent: ({ content }) => sanitizeHtml(content),
    sharing: (root, args, { dataSources: { ContentItem } }, { parentType }) => ({
      url: ContentItem.generateShareUrl(root, parentType),
      title: 'Share via ...',
      message: ContentItem.generateShareMessage(root),
    }),
    checkin: ({ id }, args, { dataSources: { CheckInable } }, { parentType }) =>
      CheckInable.getByContentItem(id)
  },
}

export default resolver
