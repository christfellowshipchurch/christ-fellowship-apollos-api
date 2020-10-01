import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import { get, mapValues, isNull, filter, head } from 'lodash';
import moment from 'moment';
import momentTz from 'moment-timezone';
import { getIdentifierType } from '../utils';
const { ROCK_MAPPINGS } = ApollosConfig;

const { createImageUrlFromGuid } = Utils;

/** TEMPORARY FIX
 *  In order to launch the My Groups feature in time for the September, 2020 Fall
 *  Groups Launch, we needed a quick and easy way to exclude a specific subset of
 *  groups that are not intended to behave like a "small group"
 *
 *  Long term "todo" is to filter by a specific group type OR to add a toggle inside
 *  of Rock that can be filtered on.
 */

const EXCLUDE_IDS = [
  269201,
  242028,
  1004296,
  810456,
  810457,
  810458,
  245763,
  910040,
  956591,
  956595,
  956596,
  956597,
  1039500,
  1040691,
  1041021,
  241739,
  241743,
  241744,
  241745,
  1042531,
  1032478,
  1032476,
  1032477,
  1032459,
  1032479,
  1032480,
  1032481,
  1032482,
  1032483,
  1032484,
  1032485,
  1032486,
  1032487,
  1032488,
  1032489,
];

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
        expiresIn: 60 * 60 * 12, // 12 hour cache
      });
    }

    return group;
  };

  getMembers = async (groupId) => {
    const { Person } = this.context.dataSources;
    const members = await this.request('GroupMembers')
      .andFilter(`GroupId eq ${groupId}`)
      .andFilter(`GroupMemberStatus eq '1'`)
      .get();
    return Promise.all(
      members.map(({ personId }) => Person.getFromId(personId))
    );
  };

  getLeaders = async (groupId) => {
    const { Person } = this.context.dataSources;
    const members = await this.request('GroupMembers')
      .filter(`GroupId eq ${groupId}`)
      .andFilter('GroupRole/IsLeader eq true')
      .andFilter(`GroupMemberStatus eq '1'`)
      .expand('GroupRole')
      .get();
    const leaders = await Promise.all(
      members.map(({ personId }) => Person.getFromId(personId))
    );
    return leaders.length ? leaders : null;
  };

  addMemberAttendance = async (id) => {
    const { scheduleId, campusId } = await this.request('Groups')
      .filter(`Id eq ${id}`)
      .first();
    const { start } = await this.getDateTimeFromId(scheduleId);

    // Check to see if the current date is the date of the meeting before taking attendance.
    if (moment(start).format('MMDDYYYY') !== moment().format('MMDDYYYY'))
      return null;

    const currentPerson = await this.context.dataSources.Auth.getCurrentPerson();

    const { locationId } = await this.request('Campuses')
      .filter(`Id eq ${campusId}`)
      .first();
    const occurrenceDate = momentTz
      .tz(start, ApollosConfig.ROCK.TIMEZONE)
      .format('l LT');

    try {
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
      // Filter by Group Type Id up here
      .andFilter(
        this.getGroupTypeIds()
          .map((id) => `(GroupRole/GroupTypeId eq ${id})`)
          .join(' or ')
      )
      .get();

    // Get the actual group data for the groups above.
    const groups = await Promise.all(
      groupAssociations
        // Temp solution for protected group ids
        .filter(({ groupId }) => !EXCLUDE_IDS.includes(groupId))
        .map(({ groupId: id }) => this.getFromId(id))
    );

    // Filter the groups to make sure we only pull those that are
    // active and NOT archived
    const filteredGroups = await Promise.all(
      groups.filter(
        (group) => group && group.isActive && !group.isArchived
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
    const { ContentItem } = this.context.dataSources;
    const matrixAttributeValue = get(attributeValues, 'resources.value', '');

    const items = await this.getMatrixItemsFromId(matrixAttributeValue);
    return Promise.all(
      items.map(async (item) => {
        // If a resource is a contentChannelItem parse guid into apollos id and set it as the value
        if (item.attributeValues.contentChannelItem.value !== '') {
          const contentItem = await this.getContentChannelItem(
            item.attributeValues.contentChannelItem.value
          );

          return {
            title: get(item, 'attributeValues.title.value'),
            action: 'READ_CONTENT',
            relatedNode: {
              ...contentItem,
              __type: ContentItem.resolveType(item),
            },
          };
        }

        return {
          title: get(item, 'attributeValues.title.value'),
          action: 'OPEN_URL',
          relatedNode: {
            __type: 'Url',
            id: createGlobalId(get(item, 'attributeValues.url.value'), 'Url'),
            url: get(item, 'attributeValues.url.value'),
          },
        };
      })
    );
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

  getDateTimeFromId = async (id) => {
    const schedule = await this.getScheduleFromId(id);
    const { iCalendarContent, weeklyDayOfWeek, weeklyTimeOfDay } = schedule;

    // Use iCalendarContent if it exists else use weeklyDayOfWeek and weeklyTimeOfDay to create a start and end time for schedules.
    if (iCalendarContent !== '') {
      const occurrences = await this.context.dataSources.Schedule.getOccurrences(
        schedule.id
      );

      const nextOccurrence = head(occurrences);
      return { start: nextOccurrence.start, end: nextOccurrence.end };
    } else if (weeklyDayOfWeek !== null && weeklyTimeOfDay) {
      const proto = Object.getPrototypeOf(moment());
      proto.setTime = function (time) {
        const [hour, minute, seconds] = time.split(':');
        return this.set({ hour, minute, seconds });
      };
      const time = moment()
        .tz(ApollosConfig.ROCK.TIMEZONE)
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
    // Returns a Defined Value Guid
    const videoCallLabelText = get(
      attributeValues,
      'videoCallLabelText.value',
      ''
    );
    if (zoomLink != '') {
      const { DefinedValue } = this.context.dataSources;
      // Parse Zoom Meeting links that have ids and/or passwords.
      const regexMeetingId = zoomLink.match(/j\/(\d+)/);
      const regexPasscode = zoomLink.match(/\?pwd=(\w+)/);

      // If url link does not match Zoom url pattern this will return the link string and meetingId and passcode will be null.
      const passcode = isNull(regexPasscode) ? null : regexPasscode[1];
      const meetingId = isNull(regexMeetingId) ? null : regexMeetingId[1];

      return {
        link: zoomLink,
        meetingId: meetingId,
        passcode,
        labelText: DefinedValue.getValueById(videoCallLabelText),
      };
    }
    return null;
  };

  getGroupParentVideoCallParams = async ({
    parentGroupId,
    attributeValues,
  }) => {
    const groupParent = await this.request('Groups').find(parentGroupId).get();
    const zoomLink = get(groupParent, 'attributeValues.zoom.value', '');
    // Returns a Defined Value Guid
    const parentVideoCallLabelText = get(
      attributeValues,
      'parentVideoCallLabelText.value',
      ''
    );
    if (zoomLink != '') {
      const { DefinedValue } = this.context.dataSources;
      // Parse Zoom Meeting links that have ids and/or passwords.
      const regexMeetingId = zoomLink.match(/j\/(\d+)/);
      const regexPasscode = zoomLink.match(/\?pwd=(\w+)/);
      // If url link does not match Zoom url pattern this will return the link string and meetingId and passcode will be null.
      const passcode = isNull(regexPasscode) ? null : regexPasscode[1];
      const meetingId = isNull(regexMeetingId) ? null : regexMeetingId[1];
      return {
        link: zoomLink,
        meetingId: meetingId,
        passcode,
        labelText: DefinedValue.getValueById(parentVideoCallLabelText),
      };
    }
    return null;
  };

  allowMessages = ({ attributeValues }) => {
    return get(attributeValues, 'allowMessages.value', '');
  };

  getTitle = ({ attributeValues, name }) => {
    const titleOverride = get(attributeValues, 'titleOverride.value', '');
    if (titleOverride !== '') {
      return titleOverride;
    }
    return name;
  };
}
