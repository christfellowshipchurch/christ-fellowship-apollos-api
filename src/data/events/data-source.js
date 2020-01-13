import {
  Event as coreEvent,
} from '@apollosproject/data-connector-rock'
import { flattenDeep } from 'lodash'
import { dataSource as scheduleDataSource } from '../schedule'
import moment from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'

export default class Event extends scheduleDataSource {

  parseScheduleAsEvents = async (schedule) => {
    // parseiCalendar returns an array of objects and mapping each schedule
    // will result in an array of arrays of objects: 
    // [ { start, end }, { start, end } ]
    const scheduleOccurrences = await this.context.dataSources.Schedule.parseiCalendar(schedule.iCalendarContent)

    // map the schedule occurrences to include
    // some original properties and filter for
    // events that end today or before today
    return scheduleOccurrences.map(o => ({
      ...o,
      name: schedule.name,
      description: schedule.description,
      attributeValues: schedule.attributeValues,
      iCalendarContent: schedule.iCalendarContent
    })).filter(event => moment().isSameOrBefore(moment(event.end)))
  }

  parseSchedulesAsEvents = async (schedules) => {
    // parseiCalendar returns an array of objects and mapping each schedule
    // will result in an array of arrays of objects: 
    // [ [ { start, end } ], [ { start, end }, { start, end } ] ]
    const scheduleOccurrences = await Promise.all(
      schedules.map(schedule =>
        this.parseScheduleAsEvents(schedule)
      )
    )

    // using flattenDeep, we simplify this array to single array of objects:
    // [ { start, end }, { start, end }, { start, end } ]
    return flattenDeep(scheduleOccurrences)
  }

  getDateTime = (schedule) => {
    const iCal = schedule.iCalendarContent;
    const dateTimes = iCal.match(/DTEND:(\w+).*DTSTART:(\w+)/s);

    return {
      start: moment
        .tz(dateTimes[2], ApollosConfig.ROCK.TIMEZONE)
        .utc()
        .format(),
      end: moment
        .tz(dateTimes[1], ApollosConfig.ROCK.TIMEZONE)
        .utc()
        .format(),
    };
  }
}
