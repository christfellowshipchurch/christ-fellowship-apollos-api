import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import ical from 'node-ical'
import moment from 'moment-timezone'
import { flattenDeep } from 'lodash'
import { getIdentifierType } from '../utils'

export default class Schedule extends RockApolloDataSource {
  resource = 'Schedules'

  getFromId = (id) => this.request()
    .filter(getIdentifierType(id).query)
    .get()

  getFromIds = (ids) =>
    this.request()
      .filterOneOf(ids.map(n => getIdentifierType(n).query))
      .get()

  parseiCalendar = async (iCal) => {
    // Let's grab the iCal content
    // const iCal = event.schedule.iCalendarContent
    const iCalEvent = Object.values(await ical.async.parseICS(iCal))

    return flattenDeep(
      iCalEvent.map((n) => {
        // Sometimes we have a "recurring rule"
        if (n.rrule) {
          // Using the embeded RRule JS library, let's grab all times this event occurs.
          const { rrule } = n
          //
          return rrule
            .all()
            .map(o => {
              const occurance = moment.tz(
                o,
                ApollosConfig.ROCK.TIMEZONE
              )
              const offset = moment.tz
                .zone(ApollosConfig.ROCK.TIMEZONE)
                .utcOffset(occurance)

              return occurance.add(offset, 'minutes').toISOString()
            })

          // Rock also likes to throw events inside this rdate property in the iCal string.
        } else if (n.rdate) {
          // rdate's aren't supported by the iCal library. Let's parse them ourselves.
          return n.rdate
            .split(',') // Take a list of values
            .map((d) => moment.tz(d, ApollosConfig.ROCK.TIMEZONE).toDate()) // Use moment to parse them into dates
            .find((d) => d > new Date()) // Now find the one that happens soonest (it's already sorted by earliest to latest)
        }
      })
    )
  }
}