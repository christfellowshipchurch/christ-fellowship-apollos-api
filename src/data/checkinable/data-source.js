import { RESTDataSource } from 'apollo-datasource-rest';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import ApollosConfig from '@apollosproject/config';
import { parseGlobalId } from '@apollosproject/server-core';
import { flatten, get, toNumber } from 'lodash';
import moment from 'moment-timezone';
import { getIdentifierType } from '../utils';

const { ROCK, ROCK_CONSTANTS, ROCK_MAPPINGS } = ApollosConfig;

const sortOptions = ({ startDateTime: a }, { startDateTime: b }) => moment(a).diff(b);

export default class Checkinable extends RockApolloDataSource {
  /** In order to trigger a Rock Webhook, we need to just hit the base
   *  rock url without the `/api` appended. For this, we are going to
   *  set the baseUrl to just that. For any other API requests that need
   *  to happen in this datasource, just remember to prefix your request with `/api`
   */
  get baseURL() {
    return process.env.ROCK_API;
  }

  async getFromId(id) {
    const { GroupItem } = this.context.dataSources;
    return GroupItem.getFromId(id);
  }

  /**
   * @param {Object} group                Rock Group.
   * @param {Number} group.id             Group Id.
   * @param {Number} group.groupTypeId    Group Type Id.
   * @param {Number} group.scheduleId     Schedule Id.
   *
   * @param {Object} args                 Describes additional information for fetching options.
   * @param {Number} args.personId        Person Id used to determine `isCheckedIn`.
   * @param {String} args.forDate         Date to get Check In Options for.
   */
  getOptions({ id, groupTypeId, scheduleId }, { personId, forDate }) {
    try {
      switch (groupTypeId) {
        case 37: // Dream Team
          return this.getVolunteerGroupOptions({ id, personId, forDate });
        case 31: // Adult Groups
        default:
          return this.getGroupOptions({ id, personId, forDate, scheduleId });
      }
    } catch (e) {
      console.log({ e });
    }

    return [];
  }

  /**
   * @param {Object}  props
   * @param {Number}  props.groupId       Group Id.
   * @param {Number}  group.scheduleId    Schedule Id.
   * @param {Number}  props.personId      Person Id used to determine `isCheckedIn`.
   * @param {String}  props.forDate       Date to get Check In Options for.
   * @param {Boolean} props.isActive      Filter schedule for active options. Defaults to true.
   */
  async parseCheckInSchedule({
    groupId,
    scheduleId,
    personId,
    forDate,
    isActive = true,
  }) {
    const { Schedule } = this.context.dataSources;
    const { nextStart, startOffset, endOffset } = await Schedule.parseById(scheduleId);

    /** Check to make sure the nextStartDateTime is valid */
    if (nextStart && moment(nextStart).isValid()) {
      /** Beginning of the most recent instance */
      const instanceStartDate = moment.tz(nextStart, ROCK.TIMEZONE).utc();
      /** Allowed start time for the check in */
      const checkInStart = moment(instanceStartDate.format()).subtract(
        startOffset,
        'minutes'
      );
      /** Allowed end time for the check in */
      const checkInEnd = moment(instanceStartDate.format()).add(endOffset, 'minutes');

      const returnData = {
        /** Person Id is required
         *  If the Start Date is right now or in the past, let's check for
         *  a check in record. If it's in the future, there's no way for
         *  someone to have already checked in, so we can just assume false
         *  and save us a few API calls
         */
        id: scheduleId,
        isCheckedIn: this.personIsCheckedIn({ groupId, scheduleId, personId, forDate }),
        startDateTime: instanceStartDate.format(),
      };

      /** We want to only allow a schedule to be added if the current time falls
       *  between the start and end date/time of the schedule
       *
       *  For example: a schedule may start at 7am with 30 minutes before and after
       *  for check in. This would mean that this schedule is valid between 6:30am
       *  and 7:30am
       */
      if (isActive) {
        if (moment().isBetween(checkInStart, checkInEnd)) {
          return returnData;
        }

        return null;
      } else {
        return returnData;
      }
    }

    return null;
  }

  /**
   * @param {Object}  props
   * @param {Number}  props.groupId       Group Id.
   * @param {Number}  group.scheduleId    Schedule Id.
   * @param {Number}  props.personId      Person Id used to determine `isCheckedIn`.
   * @param {String}  props.forDate       Date to get Check In Options for.
   */
  async personIsCheckedIn({ groupId, scheduleId, personId, forDate }) {
    /** Get the Primary Alias Id for the given person */
    const { Person } = this.context.dataSources;
    const person = await Person.getFromId(personId);
    const { primaryAliasId } = person;

    if (primaryAliasId) {
      /** Get the Attendance Occurrences for the given Group and Schedule
       *
       *  Attendance Occurrences are the exact instance that a Check In
       *  is available for. This is what groups all attendances into commonalities
       *
       *  For example: Group 2 on Sept 1 @ 1pm, Group 2 on Sept 1 @ 3pm, Group 2 on Sept 7 @ 1pm, etc
       */
      const date = forDate || moment().tz(ROCK.TIMEZONE).format('YYYY-MM-DDT00:00:00');
      const attendanceOccurrences = await this.request('AttendanceOccurrences')
        .filter(`GroupId eq ${groupId}`)
        .andFilter(`ScheduleId eq ${scheduleId}`)
        .andFilter(
          `(OccurrenceDate gt datetime'${date}' or OccurrenceDate eq datetime'${date}')`
        )
        .sort([{ field: 'OccurrenceDate', direction: 'desc' }])
        .get();

      if (attendanceOccurrences.length) {
        /**
         * Get the actual attendance record
         * A valid attendence record is defined by:
         * User Did Attend and the Person Alias Id is the user's PRIMARY Alias Id
         * NOTE : We are _not_ taking into account anything other than the PRIMARY Alias Id intentionally
         */
        const attendances = flatten(
          await Promise.all(
            attendanceOccurrences.map(({ id: oid }) =>
              this.request('Attendances')
                .filter(`PersonAliasId eq ${primaryAliasId}`)
                .andFilter(`OccurrenceId eq ${oid}`)
                .andFilter(`DidAttend eq true`)
                .get()
            )
          )
        );

        /** Successfully found >= 1 attendance record for the given
         *  person id, group id, and schedule id within the minimum
         *  date
         */
        if (attendances.length) {
          return true;
        }
      }
    }

    return false;
  }

  async getVolunteerGroupOptions({ id, personId = null, forDate = null }) {
    let options = [];
    /**
     * Volunteer Groups use Group Locations to store the schedules,
     * so this will be our starting point for getting the schedules
     */
    const locations = await this.request('/GroupLocations')
      .filter(`GroupId eq ${id}`)
      .andFilter(`LocationId eq ${ROCK_MAPPINGS.LOCATION_IDS.WEB_AND_APP}`)
      .expand('Schedules')
      .get();

    /** Loop through all locations */
    await Promise.all(
      locations.map(async (l) => {
        const { schedules } = l;

        /** Loop through all schedules and parse them for the next Start time */
        await Promise.all(
          schedules.map(async (s) => {
            const { id: sid } = s;
            const schedule = await this.parseCheckInSchedule({
              scheduleId: sid,
              personId,
              forDate,
              groupId: id,
            });

            if (schedule) {
              options.push(schedule);
            }
          })
        );
      })
    );

    return options.sort(sortOptions);
  }

  async getGroupOptions({ id, personId = null, forDate = null, scheduleId }) {
    let options = [];

    if (scheduleId) {
      const schedule = await this.parseCheckInSchedule({
        groupId: id,
        scheduleId,
        personId,
        forDate,
      });
      if (schedule) {
        options.push(schedule);
      }
    }

    return options.sort(sortOptions);
  }

  mostRecentCheckIn = async (rockPersonId, rockGroupId) => {
    if (rockPersonId && rockGroupId) {
      try {
        const base = 'https://rock.christfellowship.church';
        const mostRecent = await this.get(
          `${base}/Webhooks/Lava.ashx/checkin/latest?personId=${rockPersonId}&groupId=${rockGroupId}`
        );

        if (mostRecent && mostRecent.DidAttend) {
          const m = moment.tz(mostRecent.CheckedInDate, ApollosConfig.ROCK.TIMEZONE);

          return m.utc().format();
        }
      } catch (e) {
        console.log(e);
      }
    }

    return null;
  };

  mostRecentCheckInForCurrentPerson = async (rockGroupId) => {
    if (rockGroupId) {
      try {
        const { id } = await this.context.dataSources.Auth.getCurrentPerson();

        return this.mostRecentCheckIn(id, rockGroupId);
      } catch (e) {
        console.log('User is not logged in. Skipping check in check');
      }
    }

    return null;
  };

  checkInCurrentUser = async (id, { scheduleIds = [] }) => {
    const { Workflow, Auth } = this.context.dataSources;
    const currentUser = await Auth.getCurrentPerson();

    try {
      if (scheduleIds.length) {
        await Promise.all(
          scheduleIds.map((sid) =>
            Workflow.trigger({
              id: ROCK_MAPPINGS.WORKFLOW_IDS.CHECK_IN,
              attributes: {
                personId: currentUser.id,
                groupId: id,
                scheduleId: sid,
              },
            })
          )
        );
      } else {
        await Workflow.trigger({
          id: ROCK_MAPPINGS.WORKFLOW_IDS.CHECK_IN,
          attributes: {
            personId: currentUser.id,
            groupId: id,
          },
        });
      }
    } catch (e) {
      console.log(e);
    }

    return this.getFromId(id);
  };

  isCheckedInBySchedule = async ({ scheduleIds, groupId }) => {
    const { Schedule } = this.context.dataSources;
    const mostRecentCheckIn = await this.mostRecentCheckInForCurrentPerson(groupId);

    if (mostRecentCheckIn) {
      return await Schedule.timeIsInSchedules({
        ids: scheduleIds,
        time: mostRecentCheckIn,
      });
    }

    return false;
  };

  getByContentItem = async (id) => {
    const { ContentItem, Flag } = this.context.dataSources;

    try {
      const featureStatus = await Flag.currentUserCanUseFeature('CHECK_IN');
      if (featureStatus !== 'LIVE') return null;
    } catch (e) {
      console.log(e);
      return null;
    }

    // Get the content item from the ID passed in
    const contentItem = await ContentItem.getFromId(id);

    // Find an attribute that contains the word 'group' and
    // is also a group type in Rock
    const { attributes, attributeValues } = contentItem;
    const groupKey = Object.keys(attributes).find(
      (key) =>
        key.toLowerCase().includes('group') &&
        attributes[key].fieldTypeId === ROCK_CONSTANTS.GROUP
    );

    if (groupKey && groupKey !== '') {
      // The workflow in Rock requires an integer id, so if
      // the attribute value we get is a guid, we need to get
      // the id from Rock and cache the value in Redis for later
      // access.
      const groupValue = attributeValues[groupKey].value;

      return groupValue && groupValue !== '' ? this.getFromId(groupValue) : null;
    }

    return null;
  };
}
