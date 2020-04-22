import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import ical from 'node-ical'
import moment from 'moment-timezone'
import { filter, split, flatten, first } from 'lodash'
import { getIdentifierType } from '../utils'
import { AssistantFallbackActionsInstance } from 'twilio/lib/rest/preview/understand/assistant/assistantFallbackActions'

export default class Schedule extends RockApolloDataSource {
  resource = 'Schedules'
  expanded = true

  getFromId = (id) => this.request()
    .filter(getIdentifierType(id).query)
    .get()

  getFromIds = (ids) =>
    this.request()
      .filterOneOf(ids.map(n => getIdentifierType(n).query))
      .get()

  getOccurrences = async (id) => {
    if (id) {
      const schedule = await this.getFromId(id)
      if (schedule) {
        // getFromId returns an array
        const occurrences = await this.parseiCalendar(first(schedule).iCalendarContent)
        const filteredOccurrences = filter(occurrences, ({ end }) => {
          return this.momentWithTz(end).isAfter(moment())
        })

        return filteredOccurrences.sort((a, b) => this.momentWithTz(a).diff(this.momentWithTz(b)))
      }
    }

    return null
  }

  getOccurrencesFromIds = async (ids) => {
    const nextOccurrences = await Promise.all(
      ids.map(id => this.getOccurrences(id))
    )

    return flatten(nextOccurrences)
  }

  // shorthand for converting a date to a moment
  // object with Rock's timezone offset
  momentWithTz = (date, log) => {
    const mDate = moment.tz(date, ApollosConfig.ROCK.TIMEZONE)

    return mDate.utc()
  }

  // shorthand for getting the ISO string of a
  // date with Rock's timezone offset
  toISOString = (date) => this.momentWithTz(date).toISOString()

  parseiCalendar = async (iCal, limit = 4) => {
    const iCalEvents = Object.values(await ical.async.parseICS(iCal))

    // [{ start, end, ical }]
    // if you map, you'll have to flatten the array
    // if you forEach, you can just append to an existing array <-----
    let events = []

    iCalEvents.forEach(n => {
      // get start, end, and duration
      // const { start, end } = this.context.dataSources.Event.getDateTime(n)
      const { start, end } = n

      const mStart = this.momentWithTz(start)
      const mEnd = this.momentWithTz(end)
      const duration = moment.duration(mEnd.diff(mStart))
      const minutes = duration.asMinutes()

      // append the first date to the events array
      // as an ISO string
      events.push({ start: this.toISOString(start), end: this.toISOString(end) })

      // Rock stores additional date in the rdate property, so we want to check that for more dates
      if (n.rdate) {
        // rdates are comma separated, so we split the string and loop through them all
        const rdates = split(n.rdate, ',')

        rdates.forEach(rdate => {
          // using the duration of the first occurrence, we calculate the
          // end date of this specific occurence and convert to an ISO string
          // and push it to our array of events
          events.push({
            start: this.toISOString(rdate),
            end: this.momentWithTz(rdate).add(minutes, 'minutes').toISOString()
          })
        })
      }

      // Rock will store repeated events in the rrule property
      if (n.rrule) {
        // for repeated events, we only want the very next occurence
        // based on today's date, so we use the after method of rrule
        // to get the next occurrence based on the today's date
        //  
        // in order to insure that an event will remain visible on the
        // platform while the event is happening, we offset the time of
        // 'now' by the duration of the event
        const nowWithOffset = moment().utc().subtract(minutes, 'minutes').toDate()
        const rrule = n.rrule.after(nowWithOffset)

        // since we only want the most relevant occurence, we
        // don't really care about the original start/end date
        events.push({
          start: this.toISOString(rrule),
          end: this.momentWithTz(rrule).add(minutes, 'minutes').toISOString()
        })
      }
    })

    return events
  }
}