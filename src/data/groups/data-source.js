import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import { get, mapValues, isNull, filter, head } from 'lodash';
import moment from 'moment';
import momentTz from 'moment-timezone';
import { getIdentifierType } from '../utils';
const { ROCK_MAPPINGS } = ApollosConfig;

const { createImageUrlFromGuid } = Utils;

export default class Group extends baseGroup.dataSource {
  getFromId = async (id) => {
    const { Cache } = this.context.dataSources;
    const identifier = getIdentifierType(id);

    const cachedKey = `group_${identifier.value}`;
    const cachedValue = await Cache.get({
      key: cachedKey,
    });

    if (cachedValue) {
      return cachedValue;
    }

    // Rock returns results as an array, so we want to grab the first
    const group = await this.request(`Groups`)
      .filter(identifier.query)
      .expand('Members')
      .first();

    if (group) {
      Cache.set({
        key: cachedKey,
        data: group,
        expiresIn: 60 * 60 * 24, // 24 hour cache
      });
    }

    return group;
  };

  addMemberAttendance = async (id) => {
    const currentPerson = await this.context.dataSources.Auth.getCurrentPerson();

    const { scheduleId, campusId } = await this.request('Groups')
      .filter(`Id eq ${id}`)
      .first();
    const { locationId } = await this.request('Campuses')
      .filter(`Id eq ${campusId}`)
      .first();
    const { start } = await this.getDateTimeFromId(scheduleId);
    const occurrenceDate = momentTz
      .tz(start, ApollosConfig.ROCK.TIMEZONE)
      .format('l LT');
    try {
      console.log('Creating Group Occurrence');
      await this.post(
        `/AttendanceOccurrences/CreateGroupOccurrence`,
        {},
        {
          params: {
            groupId: id,
            locationId,
            scheduleId,
            occurrenceDate,
          },
        }
      );
      console.log('Adding current user to attendance');
      await this.put(
        `/Attendances/AddAttendance`,
        {},
        {
          params: {
            groupId: id,
            locationId,
            scheduleId,
            occurrenceDate,
            personId: currentPerson.id,
          },
        }
      );
    } catch (e) {
      console.log(`Could not take attendance for current user`, e);
    }
  };

  getByPerson = async ({ personId, type = null, asLeader = false }) => {
    // Get the active groups that the person is a member of.
    // Conditionally filter that list of groups on whether or not your
    // role in that group is that of "Leader".
    const groupAssociations = await this.request('GroupMembers')
      .expand('GroupRole')
      .filter(
        `PersonId eq ${personId} ${
          asLeader ? ' and GroupRole/IsLeader eq true' : ''
        }`
      )
      .andFilter(`GroupMemberStatus ne 'Inactive'`)
      .get();

    // Get the actual group data for the groups above.
    const groups = await Promise.all(
      groupAssociations.map(({ groupId: id }) => this.getFromId(id))
    );

    // Filter the groups to make sure we only pull those that are
    // active and NOT archived
    const filteredGroups = await Promise.all(
      groups.filter(
        (group) => group.isActive === true && group.isArchived === false
      )
    );

    // Remove the groups that aren't of the types we want and return.
    return filteredGroups.filter(({ groupTypeId }) =>
      type
        ? groupTypeId === this.groupTypeMap[type]
        : Object.values(this.groupTypeMap).includes(groupTypeId)
    );
  };

  getMatrixItemsFromId = async (id) =>
    id
      ? this.request('/AttributeMatrixItems')
          .filter(`AttributeMatrix/${getIdentifierType(id).query}`)
          .get()
      : [];

  groupTypeMap = {
    Adult: ROCK_MAPPINGS.ADULT_GROUP_TYPE_ID,
    CFE: ROCK_MAPPINGS.CFE_JOURNEY_EXPERIENCE_GROUP_TYPE_ID,
    Freedom: ROCK_MAPPINGS.FREEDOM_GROUP_TYPE_ID,
    GetStronger: ROCK_MAPPINGS.GET_STRONGER_GROUP_TYPE_ID,
    HubMarriage: ROCK_MAPPINGS.HUB_MARRIAGE_STUDIES_GROUP_TYPE_ID,
    HubStudies: ROCK_MAPPINGS.HUB_STUDIES_GROUP_TYPE_ID,
    MarriageStudies: ROCK_MAPPINGS.MARRIAGE_STUDIES_GROUP_TYPE_ID,
    Students: ROCK_MAPPINGS.STUDENTS_GROUP_TYPE_ID,
    Studies: ROCK_MAPPINGS.STUDIES_GROUP_TYPE_ID,
    TableGetStronger: ROCK_MAPPINGS.TABLE_GET_STRONGER_GROUP_TYPE_ID,
    TableStudies: ROCK_MAPPINGS.TABLE_STUDIES_GROUP_TYPE_ID,
    YoungAdults: ROCK_MAPPINGS.YOUNG_ADULTS_GROUP_TYPE_ID,
  };

  getGroupTypeIds = () => Object.values(this.groupTypeMap);

  getScheduleFromId = async (id) => {
    const schedule = await this.request('Schedules').find(id).get();
    return schedule;
  };

  getGroupTypeFromId = async (id) => {
    const groupType = await this.request('GroupTypes').find(id).get();
    return groupType.name;
  };

  getContentChannelItem = (id) =>
    this.request('ContentChannelItems')
      .filter(getIdentifierType(id).query)
      .first();

  getPhoneNumbers = (id) =>
    this.request('PhoneNumbers')
      .filter(`(PersonId eq ${id}) and (IsMessagingEnabled eq true)`)
      .first();

  getResources = async ({ attributeValues }) => {
    const matrixAttributeValue = get(attributeValues, 'resources.value', '');

    const items = await this.getMatrixItemsFromId(matrixAttributeValue);
    const values = await Promise.all(
      items.map(async (item) => {
        // If a resource is a contentChannelItem parse guid into apollos id and set it as the value
        if (item.attributeValues.contentChannelItem.value !== '') {
          const contentItem = await this.getContentChannelItem(
            item.attributeValues.contentChannelItem.value
          );
          const contentItemApollosId = createGlobalId(
            contentItem.id,
            'UniversalContentItem'
          );

          item.attributeValues.contentChannelItem.value = contentItemApollosId;
          return item.attributeValues;
        }
        return item.attributeValues;
      })
    );
    const mappedValues = values.map((attribute) =>
      mapValues(attribute, (o) => o.value)
    );
    return mappedValues;
  };

  getAvatars = async (id) => {
    const members = await this.getMembers(id);
    const leaders = await this.getLeaders(id);
    const firstLeader = head(leaders);
    const filteredMembers = firstLeader
      ? filter(members, (o) => o.id !== firstLeader.id)
      : members;
    let avatars = [];
    filteredMembers.map((member) =>
      member.photo.guid
        ? avatars.push(createImageUrlFromGuid(member.photo.guid))
        : null
    );
    return avatars;
  };

  groupPhoneNumbers = async (id) => {
    const members = await this.getMembers(id);
    const currentPerson = await this.context.dataSources.Auth.getCurrentPerson();
    const filteredMembers = filter(members, (o) => o.id !== currentPerson.id);
    return Promise.all(
      filteredMembers.map(({ id }) => this.getPhoneNumbers(id))
    ).then((values) => {
      const numbers = [];
      values.map((o) => (o && o.number ? numbers.push(o.number) : null));
      return numbers;
    });
  };

  getDateTimeFromiCalendarContent = async (schedule) => {
    if (!schedule || !schedule.iCalendarContent) {
      return { start: null, end: null };
    }

    const iCal = schedule.iCalendarContent;
    const dateTimes = iCal.match(/DTEND:(\w+).*DTSTART:(\w+)/s);

    return {
      start: moment(dateTimes[2]).utc().format(),
      end: moment(dateTimes[1]).utc().format(),
    };
  };

  getDateTimeFromId = async (id) => {
    const schedule = await this.getScheduleFromId(id);
    const { iCalendarContent, weeklyDayOfWeek, weeklyTimeOfDay } = schedule;

    // Use iCalendarContent if it exists else use weeklyDayOfWeek and weeklyTimeOfDay to create a start and end time for schedules.
    if (iCalendarContent !== '') {
      return await this.getDateTimeFromiCalendarContent(schedule);
    } else if (weeklyDayOfWeek !== null && weeklyTimeOfDay) {
      const proto = Object.getPrototypeOf(moment());
      proto.setTime = function (time) {
        const [hour, minute, seconds] = time.split(':');
        return this.set({ hour, minute, seconds });
      };
      const time = moment()
        .weekday(weeklyDayOfWeek)
        .setTime(weeklyTimeOfDay)
        .utc()
        .format();

      // Adjust start/end date to be next meeting date.
      const endOfMeetingDay = moment(time).endOf('day').utc().format();
      const isAfter = moment().isAfter(endOfMeetingDay);
      if (isAfter) {
        const nextMeetingTime = moment(time).add(7, 'd').utc().format();
        return { start: nextMeetingTime, end: nextMeetingTime };
      }

      return { start: time, end: time };
    }
    return { start: null, end: null };
  };

  getGroupVideoCallParams = ({ attributeValues }) => {
    const zoomLink = get(attributeValues, 'zoom.value', '');
    if (zoomLink != '') {
      // Parse Zoom Meeting links that have ids and/or passwords.
      const regexMeetingId = zoomLink.match(/j\/(\d+)/);
      const regexPasscode = zoomLink.match(/\?pwd=(\w+)/);
      const passcode = isNull(regexPasscode) ? null : regexPasscode[1];
      return {
        link: zoomLink,
        meetingId: regexMeetingId[1],
        passcode,
      };
    }
    return null;
  };

  getGroupParentVideoCallParams = async ({ parentGroupId }) => {
    const groupParent = await this.request('Groups').find(parentGroupId).get();
    const zoomLink = get(groupParent, 'attributeValues.zoom.value', '');
    if (zoomLink != '') {
      // Parse Zoom Meeting links that have ids and/or passwords.
      const regexMeetingId = zoomLink.match(/j\/(\d+)/);
      const regexPasscode = zoomLink.match(/\?pwd=(\w+)/);
      const passcode = isNull(regexPasscode) ? null : regexPasscode[1];
      return {
        link: zoomLink,
        meetingId: regexMeetingId[1],
        passcode,
      };
    }
    return null;
  };
}
