import { Event as coreEvent } from '@apollosproject/data-connector-rock';
import { flattenDeep, isEmpty, get } from 'lodash';
import { compareAsc, parseISO } from 'date-fns';
import moment from 'moment-timezone';
import ApollosConfig from '@apollosproject/config';
import { dataSource as scheduleDataSource } from '../schedule';

export default class Event extends scheduleDataSource {
  getFromId = (id) => {
    const decoded = JSON.parse(id);

    return this.request()
      .filter(`Id eq ${decoded.id}`)
      .transform((result) =>
        result.map((node, i) => ({
          ...node,
          start: decoded.start,
          end: decoded.end,
        }))
      )
      .first();
  };

  parseScheduleAsEvents = async (schedule) => {
    if (!schedule || !schedule.iCalendarContent) return [];

    // parseiCalendar returns an array of objects and mapping each schedule
    // will result in an array of arrays of objects:
    // [ { start, end }, { start, end } ]
    const scheduleOccurrences = await this.context.dataSources.Schedule.parseiCalendar(
      schedule.iCalendarContent
    );

    // map the schedule occurrences to include
    // some original properties and filter for
    // events that end today or before today
    return scheduleOccurrences
      .map((o) => ({
        ...o,
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        attributeValues: schedule.attributeValues,
        iCalendarContent: schedule.iCalendarContent,
      }))
      .filter((event) => moment().isSameOrBefore(moment(event.end)));
  };

  parseSchedulesAsEvents = async (schedules) => {
    // parseiCalendar returns an array of objects and mapping each schedule
    // will result in an array of arrays of objects:
    // [ [ { start, end } ], [ { start, end }, { start, end } ] ]
    const scheduleOccurrences = await Promise.all(
      schedules.map((schedule) => this.parseScheduleAsEvents(schedule))
    );

    // using flattenDeep, we simplify this array to single array of objects:
    // [ { start, end }, { start, end }, { start, end } ]
    return flattenDeep(scheduleOccurrences);
  };

  getDateTime = (schedule) => {
    const iCal = schedule.iCalendarContent;
    const dateTimes = iCal.match(/DTEND:(\w+).*DTSTART:(\w+)/s);

    return {
      start: moment.tz(dateTimes[2], ApollosConfig.ROCK.TIMEZONE).utc().format(),
      end: moment.tz(dateTimes[1], ApollosConfig.ROCK.TIMEZONE).utc().format(),
    };
  };

  /**
   * Creates a label based on a Rock Content Item
   * @param {ContentItem} root
   * @returns string
   */
  createLabelText = async ({ attributeValues }) => {
    const label = attributeValues?.label?.value;

    if (label && !isEmpty(label)) return label;

    const { MatrixItem, Schedule } = this.context.dataSources;
    // Get Matrix Items
    const matrixGuid = get(attributeValues, 'schedules.value', '');
    let matrixItems = [];

    if (!matrixGuid || matrixGuid === '') return [];

    try {
      matrixItems = await MatrixItem.getItemsFromId(matrixGuid);
    } catch (e) {
      console.log({ e });
      return [];
    }

    /**
     * Matrix Items are structured in Rock as: { schedule, [filters] }
     * We need to resolve those schedules to schedule objects
     */
    const scheduleIds = matrixItems
      .map((item) => item?.attributeValues?.schedule?.value)
      .filter((item) => !!item && !isEmpty(item));
    const schedules = await Schedule.getOccurrencesFromIds(scheduleIds);
    const schedule = schedules
      .sort((a, b) => compareAsc(parseISO(a), parseISO(b)))
      .find(() => true);

    return schedule?.start;
  };
}
