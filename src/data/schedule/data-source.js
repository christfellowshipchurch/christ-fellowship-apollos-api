import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import ical from 'node-ical'
import moment from 'moment-timezone'
import { filter, split, flatten, first, get, toNumber } from 'lodash'
import { getIdentifierType } from '../utils'

const { ROCK, ROCK_MAPPINGS } = ApollosConfig;
const { TIMEZONE } = ROCK

const sortByTimeAsc = (a, b) => moment(a).diff(b)

export default class Schedule extends RockApolloDataSource {
  /** MARK: - Class Properties */
  resource = 'Schedules'
  expanded = true
  defaultStartOffsetMinutes = 15 // 15 minutes
  defaultEndOffsetMinutes = 60 * 12 // 8 hours

  /** MARK: - Getters */
  getFromId = (id) => this.request()
    .filter(getIdentifierType(id).query)
    .get()

  getFromIds = (ids) =>
    this.request()
      .filterOneOf(ids.map(n => getIdentifierType(n).query))
      .get()

  getOccurrences = async (id) => {
    if (id) {
      // getFromId returns an array with 1 result, so we
      // just need to grab the first
      const scheduleArr = await this.getFromId(id)

      const schedule = first(scheduleArr)
      if (schedule) {
        const occurrences = await this.parseiCalendar(schedule.iCalendarContent)
        const filteredOccurrences = filter(occurrences, ({ end }) => {
          return moment.utc(end).isAfter(moment())
        })

        // Rock schedules include an offset in minutes, so we want to pass
        // that along for the objects that need to take offsets into account
        const startOffset = get(schedule, 'checkInStartOffsetMinutes', 0)
        return filteredOccurrences
          .map(o => ({
            ...o,
            startWithOffset: moment(o.start).subtract(startOffset, 'm').toISOString()
          }))
          .sort((a, b) => moment.utc(a).diff(moment.utc(b)))
      }
    }

    return null
  }

  getOccurrencesFromIds = async (ids) => {
    const nextOccurrences = await Promise.all(
      ids.map(id => this.getOccurrences(id))
    )

    return flatten(nextOccurrences).sort((a, b) => moment(a.startWithOffset).diff(moment(b.startWithOffset)))
  }

  /** MARK: - Parsing Rock Schedule Types */
  parse({
    id,
    iCalendarContent,
    weeklyDayOfWeek,
    weeklyTimeOfDay
  }) {
    let scheduleType = "none"

    if (iCalendarContent === "" && weeklyDayOfWeek !== null && weeklyTimeOfDay !== "") {
      /** Weekly schedules have a set day of week and time, but no iCalendar
       *  string associated with the schedule
       */
      scheduleType = "weekly"
    }

    if (iCalendarContent && iCalendarContent !== "") {
      /** Check for either a Custom or Named schedule */
      const iCalStart = iCalendarContent.match(/DTSTART:(\w+)/s);
      const iCalEnd = iCalendarContent.match(/DTEND:(\w+)/s);
      const duration = moment
        .tz(iCalEnd[1], ApollosConfig.ROCK.TIMEZONE)
        .diff(moment.tz(iCalStart[1], ApollosConfig.ROCK.TIMEZONE))

      /** Custom schedules have an iCalendar string, but duration of the event
       *  is only 1 second.
       */
      if (duration <= 1000) {
        scheduleType = "custom"
      } else {
        scheduleType = "named"
      }
    }

    switch (scheduleType) {
      case "custom":
        return this._parseCustomSchedule(iCalendarContent)
      case "named":
        return this._parseNamedSchedule(id)
      case "weekly":
        return this._parseWeeklySchedule({
          weeklyDayOfWeek,
          weeklyTimeOfDay
        })
      default:
        return {
          nextStart: null,
          startOffset: 0,
          endOffset: 0
        }
    }
  }

  async parseById(id) {
    /** Gets the schedule from Rock and then parses
     */
    const schedule = await this.getFromId(id)

    return this.parse(first(schedule))
  }

  async _parseNamedSchedule(id) {
    /** Named schedules will include a duration, check in start offset and check in end offset
     *  (in minutes) and there is a parser using Lava that gives us all of these values
     */
    const lava = `{% schedule id:'${id}' %}
        {
            "nextStartDateTime": "{{ schedule.NextStartDateTime | Date:'yyyy-MM-dd HH:mm' }}",
            "startOffsetMinutes": "{{ schedule.CheckInStartOffsetMinutes }}",
            "endOffsetMinutes": "{{ schedule.CheckInEndOffsetMinutes }}"
        }
    {% endschedule %}`

    /** Parse the response and get each property of the response */
    const response = await this.post(`/Lava/RenderTemplate`, lava.replace(/\n/g, ""))
    const jsonResponse = JSON.parse(response)
    const scheduleStartOffsetMinutes = toNumber(get(jsonResponse, 'startOffsetMinutes', 0))
    const scheduleEndOffsetMinutes = toNumber(get(jsonResponse, 'endOffsetMinutes', 0))

    /** Build the final return object with defaults taken into consideration */
    const nextStart = get(jsonResponse, 'nextStartDateTime')
    const startOffset = scheduleStartOffsetMinutes <= 0
      ? this.defaultStartOffsetMinutes
      : scheduleStartOffsetMinutes
    const endOffset = scheduleEndOffsetMinutes <= 0
      ? this.defaultEndOffsetMinutes
      : scheduleEndOffsetMinutes

    return {
      nextStart, // Keep a null start date by default for easier value checking
      startOffset, // Default the startOffset if the offset is 0
      endOffset // Default the endOffset if the offset is 0
    }
  }

  async _parseCustomSchedule(iCalendar) {
    const events = await this.parseiCalendar(iCalendar,
      {
        duration: this.defaultEndOffsetMinutes
      })

    /** TL;DR: parseiCalendar filters by the _day_ of the event, not the time
     *  
     *  The first event that is returned is the closest event.
     *  If the event is today, but already past the time 
     *  (ie: event starts at 9am and right now is 10am), the event
     *  will still return today's instance.
     */

    const filteredDates = events
      .filter(e => moment(e.start).isSameOrAfter(moment().startOf('day')))
      .sort(sortByTimeAsc)
    const closestDate = first(filteredDates)
    const nextStart = get(closestDate, 'start')

    return {
      nextStart,
      startOffset: this.defaultStartOffsetMinutes,
      endOffset: this.defaultEndOffsetMinutes
    };
  }

  _parseWeeklySchedule({ weeklyDayOfWeek, weeklyTimeOfDay }) {
    const proto = Object.getPrototypeOf(moment());
    proto.setTime = function (time) {
      const [hour, minute, seconds] = time.split(':');
      return this.set({ hour, minute, seconds });
    };
    let nextStart = moment()
      .weekday(weeklyDayOfWeek)
      .setTime(weeklyTimeOfDay)
      .tz(TIMEZONE)
      .utc()
      .format();

    /** Adjust start/end date to be next meeting date. */
    const endOfMeetingDay = moment(nextStart).endOf('day').utc().format();
    const isAfter = moment().isAfter(endOfMeetingDay);
    if (isAfter) {
      const newNextStart = moment(nextStart).add(7, 'd').utc().format();
      nextStart = newNextStart
    }

    return {
      nextStart,
      startOffset: this.defaultStartOffsetMinutes,
      endOffset: this.defaultEndOffsetMinutes
    };
  }

  /** MARK: - iCalendar */
  /**
   * @param {String} iCalendar string to parse.
   * @param {Object} args Arguments to pass in to describe the parse.
   * @param {Number} args.duration Manually set the duration of each instance of the event. Defaulted to the duration of the event set by the iCalendar string.
   */
  parseiCalendar = async (iCal, args = {}) => {
    const duration = get(args, 'duration')
    /** Before parsing the iCal object, we need to find and replace the start and end data/time
     *  with one that specifies the current timezone of the event
     * 
     *  Rock returns a DTSTART/DTEND in the following format: DTSTART:20200419T171500
     *  which is ambiguous to the time zone, so node-ical will pick the local one
     *  node-ical wants time zone specified in the following manner: DTSTART;TZID=America/New_York:20200419T171500
     *  which we have to do manually
     */
    const iCalStart = iCal.match(/DTSTART:(\w+)/s);
    const iCalEnd = iCal.match(/DTEND:(\w+)/s);
    const iCalAdjusted = iCal
      .replace(iCalStart[0], `DTSTART;TZID=${ApollosConfig.ROCK.TIMEZONE}:${iCalStart[1]}`)
      .replace(iCalEnd[0], `DTEND;TZID=${ApollosConfig.ROCK.TIMEZONE}:${iCalEnd[1]}`)

    const iCalEvents = Object.values(await ical.async.parseICS(iCalAdjusted))

    /** [{ start, end, ical }]
     *  if you map, you'll have to flatten the array
     *  if you forEach, you can just append to an existing array <-----
     */
    let events = []

    iCalEvents.forEach(n => {
      /** get start, end, and duration
       *  const { start, end } = this.context.dataSources.Event.getDateTime(n)
       */
      const { start, end } = n

      const mStart = moment.utc(start)
      const mEnd = moment.utc(end)
      const _duration = moment.duration(mEnd.diff(mStart))
      const minutes = duration || _duration.asMinutes()

      /** append the first date to the events array
       *  as an ISO string
       */
      events.push({ start: this.toISOString(start), end: this.toISOString(end) })

      /** Rock stores additional date in the rdate property, so we want to check that for more dates */
      if (n.rdate) {
        /** rdates are comma separated, so we split the string and loop through them all */
        const rdates = split(n.rdate, ',')

        rdates.forEach(rdate => {
          /** using the duration of the first occurrence, we calculate the
           * end date of this specific occurence and convert to an ISO string
           * and push it to our array of events
           */
          events.push({
            start: this.toISOString(rdate),
            end: moment.utc(rdate).add(minutes, 'minutes').toISOString()
          })
        })
      }

      /** Rock will store repeated events in the rrule property */
      if (n.rrule) {
        /** For repeated events, we only want the very next occurence
         *  based on today's date, so we use the after method of rrule
         *  to get the next occurrence based on the today's date
         *  
         *  In order to insure that an event will remain visible on the
         *  platform while the event is happening, we offset the time of
         *  'now' by the duration of the event
         */
        const nowWithOffset = moment().utc().subtract(minutes, 'minutes').toDate()
        const rrule = n.rrule.after(nowWithOffset)

        /** Since we only want the most relevant occurence, we
         *  don't really care about the original start/end date
         */
        events.push({
          start: this.toISOString(rrule),
          end: moment.utc(rrule).add(minutes, 'minutes').toISOString()
        })
      }
    })

    return events
  }

  /** MARK: - Utils */
  momentWithTz = (date, log) => {
    /**
     * Shorthand for converting a date to a moment
     * Object with Rock's timezone offset
     */
    const mDate = moment.tz(date, ApollosConfig.ROCK.TIMEZONE)

    return mDate.utc()
  }

  toISOString = (date) => {
    /**
     * Shorthand for getting the ISO string of a
     * Date with Rock's timezone offset
     */
    return moment.utc(date).toISOString()
  }

  timeIsInSchedules = async ({ ids, time }) => {
    const times = await this.getOccurrencesFromIds(ids)
    const nextTime = first(times)

    if (nextTime) {
      const start = get(nextTime, 'startWithOffset')
      const end = get(nextTime, 'end')

      if (start && end) {
        return moment(time).isBetween(moment(start), moment(end))
      }
    }

    return false
  }
}