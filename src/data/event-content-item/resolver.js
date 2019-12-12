import ApollosConfig from '@apollosproject/config'
import {
  ContentItem as coreContentItem,
} from '@apollosproject/data-connector-rock'
import {
  get,
  has,
  split,
  flatten
} from 'lodash'
import moment from 'moment'
import momentTz from 'moment-timezone'

import { parseRockKeyValuePairs } from '../utils'

const resolver = {
  EventContentItem: {
    ...coreContentItem.resolver.ContentItem,
    startDate: (props) =>
      momentTz.tz(
        get(props, 'startDateTime', new Date()),
        ApollosConfig.ROCK.TIMEZONE
      ),
    endDate: ({ expireDateTime }) =>
      moment(expireDateTime).isValid()
        ? momentTz.tz(
          expireDateTime,
          ApollosConfig.ROCK.TIMEZONE
        ) : null,
    tags: ({ attributeValues }) =>
      split(get(attributeValues, 'tags.value', ''), ','),
    callsToAction: ({ attributeValues }, args, { dataSources }) =>
      parseRockKeyValuePairs(
        get(attributeValues, 'callsToAction.value', ''),
        'call',
        'action')
  },
  EventScheduleItem: {
    ...coreContentItem.resolver.ContentItem,
    dates: async ({ startDateTime, attributeValues }, args, { dataSources }) => {
      console.log({ attributeValues })

      const scheduleGuids = get(attributeValues, 'schedules.value', null)

      if (scheduleGuids) {
        // Rock returns multiple schedules as a single string of GUIDs separated
        //  by a comma
        const rockSchedules = await dataSources.Schedule.getFromIds(split(scheduleGuids, ','))

        // After getting the schedules back from Rock, we want to pull the iCalendarContent
        //  from each of the schedules, then have each of them parsed into Date Strings
        const mappedSchedule = await Promise.all(rockSchedules.map((n) => {
          return dataSources.Schedule.parseiCalendar(n.iCalendarContent)
        }))

        // The format of mappedSchedules will be an array of string arrays: [ [String] ]
        //  We want a single array sorted by date, so we needed to flatted our array
        //  and then sort it before returning
        return flatten(mappedSchedule)
          .sort((a, b) => {
            const dateA = new Date(a)
            const dateB = new Date(b)
            return dateA - dateB
          })
      }

      // If no schedule exists, return the start date of the item
      return [
        momentTz.tz(startDateTime, ApollosConfig.ROCK.TIMEZONE),
      ]
    },
    campuses: ({ attributeValues }, args, { dataSources }) =>
      dataSources.Campus.getFromIds(
        split(
          get(attributeValues, 'campuses.value', ''),
          ','
        )
      ),
    location: ({ attributeValues }) => get(attributeValues, 'location.value', ''),
  }
}

export default resolver
