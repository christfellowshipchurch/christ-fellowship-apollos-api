/**
 * Deprecated: 1.1.2
 * These resolvers were deprecated as a part of updating and simplifying the way that 
 * we manage events from a CMS perspecitve.
 * 
 * The Schema has been incredibly simplified in this update for events.
 */
import {
  get,
  split,
  flatten,
  toLower
} from 'lodash'
import moment from 'moment'

const deprecatedResolvers = {
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
  tags: ({ attributeValues }) => split(get(attributeValues, 'tags.value', ''), ','),
  openLinksInNewTab: ({ attributeValues }) => toLower(get(attributeValues, 'openLinksInNewTab.value', 'false')) === 'true',
  hideLabel: ({ attributeValues }) => toLower(get(attributeValues, 'hideLabel.value', 'false')) === 'true',
  events: async ({ title, attributeValues }, args, { dataSources }) => {
    return []

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
}

export default deprecatedResolvers
