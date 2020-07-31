import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { get, mapValues, isNull } from 'lodash';
import moment from 'moment';
import { getIdentifierType } from '../utils';
const { ROCK_MAPPINGS } = ApollosConfig;

const { createImageUrlFromGuid } = Utils;

export default class Group extends baseGroup.dataSource {
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
      groupAssociations.map(({ groupId }) => this.getFromId({ id: groupId }))
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

  getScheduleFromId = async (id) => {
    const schedule = await this.request('Schedules').find(id).get();
    return schedule;
  };

  getGroupTypeFromId = async (id) => {
    const groupType = await this.request('GroupTypes').find(id).get();
    return groupType.name;
  };

  getResources = async ({ attributeValues }) => {
    const matrixAttributeValue = get(attributeValues, 'resources.value', '');

    const items = await this.getMatrixItemsFromId(matrixAttributeValue);
    const values = items.map((item) => item.attributeValues);
    const mappedValues = values.map((attribute) =>
      mapValues(attribute, (o) => o.value)
    );
    return mappedValues;
  };

  getAvatars = async (id) => {
    const members = await this.getMembers(id);
    let avatars = [];
    members.map((member) =>
      member.photo.guid
        ? avatars.push(createImageUrlFromGuid(member.photo.guid))
        : null
    );
    return avatars;
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
      return { start: time, end: time };
    }
    return { start: null, end: null };
  };
}
