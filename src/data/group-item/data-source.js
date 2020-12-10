import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import {
  createGlobalId,
  createCursor,
  parseCursor,
  parseGlobalId,
} from '@apollosproject/server-core';
import { get, isNull, filter, head, chunk, flatten, take, result } from 'lodash';
import moment from 'moment';
import momentTz from 'moment-timezone';
import crypto from 'crypto-js';
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
  828068,
  1032459,
  1032476,
  1032477,
  1032478,
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

const CHANNEL_TYPE = 'group';
const GROUP_COVER_IMAGES_DEFINED_TYPE_ID = get(
  ApollosConfig,
  'ROCK_MAPPINGS.DEFINED_TYPES.GROUP_COVER_IMAGES'
);

export default class GroupItem extends baseGroup.dataSource {
  async updateCache(id) {
    const { Cache } = this.context.dataSources;
    const identifier = getIdentifierType(id);
    const cachedKey = `group_${identifier.value}`;

    // Rock returns results as an array, so we want to grab the first
    const group = await this.request(`Groups`)
      .filter(identifier.query)
      .expand('Members')
      .first();

    if (group) {
      await Cache.set({
        key: cachedKey,
        data: group,
        expiresIn: 60 * 60 * 12, // 12 hour cache
      });
    }

    return group;
  }

  getFromId = async (id) => {
    const { Cache } = this.context.dataSources;
    const identifier = getIdentifierType(id);

    const groupQuery = () =>
      this.request(`Groups`).filter(identifier.query).expand('Members').first();

    return Cache.request(groupQuery, {
      key: Cache.KEY_TEMPLATES.group`${identifier.value}`,
      data: group,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });
  };

  getMembers = async (groupId) => {
    const { Person } = this.context.dataSources;
    const members = await this.request('GroupMembers')
      .andFilter(`GroupId eq ${groupId}`)
      .andFilter(`GroupMemberStatus eq '1'`)
      .get();
    return Promise.all(members.map(({ personId }) => Person.getFromId(personId)));
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
    if (moment(start).format('MMDDYYYY') !== moment().format('MMDDYYYY')) return null;

    const currentPerson = await this.context.dataSources.Auth.getCurrentPerson();

    const { locationId } = await this.request('Campuses')
      .filter(`Id eq ${campusId}`)
      .first();
    const occurrenceDate = momentTz.tz(start, ApollosConfig.ROCK.TIMEZONE).format('l LT');

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

  userIsLeader = async (groupId, userId) => {
    const leaders = await this.request('GroupMembers')
      .filter(`GroupId eq ${groupId}`)
      .andFilter('GroupRole/IsLeader eq true')
      .andFilter(`GroupMemberStatus eq '1'`)
      .get();
    const leaderIds = leaders.map(({ personId }) => personId);

    return leaderIds.includes(userId);
  };

  getCoverImages = async () => {
    const { DefinedValueList, ContentItem } = this.context.dataSources;
    const images = await DefinedValueList.getByIdentifier(
      GROUP_COVER_IMAGES_DEFINED_TYPE_ID
    );

    return images.definedValues.map((image) => {
      return {
        guid: image.attributeValues.image.value,
        name: image.value, // The attribute value's name/label at top level
        image: ContentItem.getImages(image)[0],
      };
    });
  };

  updateCoverImage = async ({ groupId, imageId }) => {
    const { Auth, Cache, ContentItem } = this.context.dataSources;
    const currentPerson = await Auth.getCurrentPerson();

    const groupGlobalId = parseGlobalId(groupId)?.id;
    if (this.userIsLeader(groupGlobalId, currentPerson.id)) {
      const attributeKey = 'Image';
      const attributeValue = imageId;
      await this.post(
        `/Groups/AttributeValue/${groupGlobalId}?attributeKey=${attributeKey}&attributeValue=${attributeValue}`
      );

      // Set cover image cache to null and to expire immediately
      // So we can set it properly through the ContentItem function
      await Cache.set({
        key: `contentItem:coverImage:${groupGlobalId}`,
        data: null,
        expiresIn: 1,
      });

      const group = await this.updateCache(groupGlobalId);

      // Sets cover image cache
      await ContentItem.getCoverImage(group);

      return group;
    }
  };

  async addResource({ groupId, title, url, contentItemId }) {
    const { Auth, Url } = this.context.dataSources;
    const currentPerson = await Auth.getCurrentPerson();

    const groupGlobalId = parseGlobalId(groupId)?.id;
    if (this.userIsLeader(groupGlobalId, currentPerson.id)) {
      const data = {
        SourceEntityTypeId: ApollosConfig.ROCK_ENTITY_IDS.GROUP,
        SourceEntityId: groupGlobalId,
        IsSystem: false,
        QualifierValue: 'APOLLOS_GROUP_RESOURCE',
      };

      if (contentItemId) {
        data.TargetEntityTypeId = ApollosConfig.ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM;
        data.TargetEntityId = parseGlobalId(contentItemId)?.id;
      } else if (title && url) {
        const definedValueId = await Url.addToMasterList({ title, url });
        data.TargetEntityTypeId = ApollosConfig.ROCK_ENTITY_IDS.DEFINED_VALUE;
        data.TargetEntityId = definedValueId;
      } else {
        return null;
      }

      await this.post('/RelatedEntities', data);

      return this.updateCache(groupGlobalId);
    }
  }

  async updateResource({ groupId, relatedNodeId, title, url, contentItemId }) {
    if (!relatedNodeId) {
      return this.addResource({ groupId, title, url, contentItemId });
    }

    const { Auth, Url } = this.context.dataSources;
    const currentPerson = await Auth.getCurrentPerson();

    const groupGlobalId = parseGlobalId(groupId)?.id;
    if (this.userIsLeader(groupGlobalId, currentPerson.id)) {
      const entity = await this.groupResourceEntity({ groupId, relatedNodeId });
      if (entity) {
        const data = {};

        if (contentItemId) {
          data.TargetEntityId = parseGlobalId(contentItemId)?.id;
        } else if (title && url) {
          const definedValueId = await Url.addToMasterList({ title, url });
          data.TargetEntityId = definedValueId;
        } else {
          return null;
        }

        await this.patch(`/RelatedEntities/${entity.id}`, data);
        return this.updateCache(groupGlobalId);
      }
    }
  }

  async removeResource({ groupId, relatedNodeId }) {
    if (!groupId || !relatedNodeId) return null;

    try {
      const { Auth } = this.context.dataSources;
      const currentPerson = await Auth.getCurrentPerson();

      const groupGlobalId = parseGlobalId(groupId)?.id;
      if (this.userIsLeader(groupGlobalId, currentPerson.id)) {
        const entity = await this.groupResourceEntity({ groupId, relatedNodeId });
        if (entity) {
          await this.delete(`/RelatedEntities/${entity.id}`);
          return this.updateCache(groupGlobalId);
        }
      }

      return null;
    } catch (e) {
      console.log(e);
    }
  }

  async groupResourceEntity({ groupId, relatedNodeId }) {
    const groupGlobalId = parseGlobalId(groupId)?.id;
    const relatedNodeGlobalId = parseGlobalId(relatedNodeId);
    let entityTypeId;
    switch (relatedNodeGlobalId.__type) {
      case 'Url':
        entityTypeId = ApollosConfig.ROCK_ENTITY_IDS.DEFINED_VALUE;
        break;
      case 'MediaContentItem':
        entityTypeId = ApollosConfig.ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM;
        break;
      default:
        break;
    }
    if (entityTypeId) {
      return await this.request('/RelatedEntities')
        .filter(`SourceEntityTypeId eq ${ApollosConfig.ROCK_ENTITY_IDS.GROUP}`)
        .andFilter(`SourceEntityId eq ${groupGlobalId}`)
        .andFilter(`QualifierValue eq 'APOLLOS_GROUP_RESOURCE'`)
        .andFilter(`TargetEntityTypeId eq ${entityTypeId}`)
        .andFilter(`TargetEntityId eq ${relatedNodeGlobalId.id}`)
        .first();
    }

    return null;
  }

  getByPerson = async ({
    personId,
    type = null,
    asLeader = false,
    groupTypeIds = null,
  }) => {
    // Get the active groups that the person is a member of.
    // Conditionally filter that list of groups on whether or not your
    // role in that group is that of "Leader".
    const _groupTypeIds = groupTypeIds || this.getGroupTypeIds();
    const groupAssociationRequests = await Promise.all(
      chunk(_groupTypeIds, 3).map((groupTypeIds) =>
        this.request('GroupMembers')
          .expand('GroupRole')
          .filter(
            `PersonId eq ${personId} ${asLeader ? ' and GroupRole/IsLeader eq true' : ''}`
          )
          // Do not include groups where user's status is Inactive or Pending
          .andFilter(`GroupMemberStatus ne 'Inactive'`)
          .andFilter(`GroupMemberStatus ne 'Pending'`)
          // Filter by Group Type Id up here
          .andFilter(
            groupTypeIds.map((id) => `(GroupRole/GroupTypeId eq ${id})`).join(' or ')
          )
          .get()
      )
    );

    const groupAssociations = flatten(groupAssociationRequests);

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
      groups.filter((group) => group && group.isActive && !group.isArchived)
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
    DreamTeam: ROCK_MAPPINGS.GROUP_TYPE_IDS.DREAM_TEAM,
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
    this.request('ContentChannelItems').filter(getIdentifierType(id).query).first();

  getPhoneNumbers = (id) =>
    this.request('PhoneNumbers')
      .filter(`(PersonId eq ${id}) and (IsMessagingEnabled eq true)`)
      .first();

  async getGroupResources({ attributeValues }) {
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
            id: get(item, 'id'),
            title: get(item, 'attributeValues.title.value'),
            action: 'READ_CONTENT',
            relatedNode: {
              ...contentItem,
              __type: ContentItem.resolveType(item),
            },
          };
        }

        return {
          id: get(item, 'id'),
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
  }

  async getResources(id) {
    const { ContentItem, Url } = this.context.dataSources;

    return this.request('/RelatedEntities')
      .filter(`SourceEntityTypeId eq ${ApollosConfig.ROCK_ENTITY_IDS.GROUP}`)
      .andFilter(`SourceEntityId eq ${id}`)
      .andFilter(`QualifierValue eq 'APOLLOS_GROUP_RESOURCE'`)
      .transform(async (results) =>
        results
          .map(async (entity) => {
            const { targetEntityId, targetEntityTypeId } = entity;

            switch (targetEntityTypeId) {
              case ApollosConfig.ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM:
                const contentItem = await ContentItem.getFromId(targetEntityId);
                const resolvedType = ContentItem.resolveType(contentItem);

                return {
                  action: 'READ_CONTENT',
                  title:
                    get(contentItem, 'attributeValues.titleOverride.value') ||
                    get(contentItem, 'title'),
                  relatedNode: {
                    ...contentItem,
                    id: contentItem.id,
                    __type: resolvedType,
                  },
                };
              case ApollosConfig.ROCK_ENTITY_IDS.DEFINED_VALUE:
                const definedValue = await Url.getFromMasterList(targetEntityId);

                return {
                  action: 'OPEN_URL',
                  title: get(definedValue, 'title'),
                  relatedNode: {
                    ...definedValue,
                    id: definedValue.id,
                    __type: 'Url',
                  },
                };
              default:
                return null;
            }
          })
          .filter((entity) => !!entity)
      )
      .get();
  }

  // TODO: use groupId to filter results
  getResourceOptions = async (groupId) => {
    const groupResources = await this.request('/RelatedEntities')
      .filter(`SourceEntityTypeId eq ${ApollosConfig.ROCK_ENTITY_IDS.GROUP}`)
      .andFilter(`SourceEntityId eq ${groupId}`)
      .andFilter(
        `TargetEntityTypeId eq ${ApollosConfig.ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM}`
      )
      .andFilter(`QualifierValue eq 'APOLLOS_GROUP_RESOURCE'`)
      .get();

    const filter = groupResources.map((f) => `(Id ne ${f.targetEntityId})`).join(' and ');

    return this.request('/ContentChannelItems')
      .filter(`ContentChannelId eq 79`)
      .andFilter(filter);
  };

  async paginateMembersById({ after, first = 20, id, isLeader = false }) {
    let skip = 0;
    if (after) {
      const parsed = parseCursor(after);
      if (parsed && Object.hasOwnProperty.call(parsed, 'position')) {
        skip = parsed.position + 1;
      } else {
        throw new Error(`An invalid 'after' cursor was provided: ${after}`);
      }
    }

    // temporarily store the select parameter to
    // put back after "Id" is selected for the count
    const cursor = this.request('GroupMembers')
      .filter(`GroupId eq ${id}`)
      .andFilter(`GroupRole/IsLeader eq ${isLeader}`)
      .andFilter(`GroupMemberStatus eq '1'`)
      .expand('GroupRole, Person')
      .top(first)
      .skip(skip)
      .transform((results) =>
        results
          .filter((groupMember) => {
            return !!groupMember.person;
          })
          .map(({ person }, i) => {
            return {
              node: this.context.dataSources.Person.getFromId(person.id),
              cursor: createCursor({ position: i + skip }),
            };
          })
      );

    return {
      getTotalCount: cursor.count,
      edges: cursor.get(),
    };
  }

  getAvatars = async (id) => {
    try {
      const members = await this.getMembers(id);
      const leaders = await this.getLeaders(id);
      const firstLeader = head(leaders);
      const filteredMembers = firstLeader
        ? filter(members, (o) => o.id !== firstLeader.id)
        : members;
      let avatars = [];
      filteredMembers.map((member) =>
        member.photo.guid ? avatars.push(createImageUrlFromGuid(member.photo.guid)) : null
      );
      return take(avatars, 15);
    } catch (e) {
      console.log({ e });
    }

    return [];
  };

  groupPhoneNumbers = async (id) => {
    const members = await this.getMembers(id);
    const currentPerson = await this.context.dataSources.Auth.getCurrentPerson();
    const filteredMembers = filter(members, (o) => o.id !== currentPerson.id);
    return Promise.all(filteredMembers.map(({ id }) => this.getPhoneNumbers(id))).then(
      (values) => {
        const numbers = [];
        values.map((o) => (o && o.number ? numbers.push(o.number) : null));
        return numbers;
      }
    );
  };

  getDateTimeFromId = async (id) => {
    if (!id) return null;

    const { Schedule } = this.context.dataSources;
    const schedule = await Schedule.parseById(id);

    if (schedule.nextStart) {
      const { nextStart } = schedule;
      const endOfMeetingDay = moment(nextStart).endOf('day').utc().format();
      const isAfter = moment().isAfter(endOfMeetingDay);
      if (isAfter) {
        const nextMeetingTime = moment(time).add(7, 'd').utc().format();
        return { start: nextMeetingTime, end: nextMeetingTime };
      }

      return { start: nextStart, end: nextStart };
    }

    return { start: null, end: null };
  };

  getGroupVideoCallParams = ({ attributeValues }) => {
    const zoomLink = get(attributeValues, 'zoom.value', '');
    // Returns a Defined Value Guid
    const videoCallLabelText = get(attributeValues, 'videoCallLabelText.value', '');
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

  getGroupParentVideoCallParams = async ({ parentGroupId, attributeValues }) => {
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

  getChatChannelId = async (root) => {
    // TODO : break up this logic and move it to the StreamChat DataSource
    const { Auth, StreamChat, Flag } = this.context.dataSources;
    const featureFlagStatus = await Flag.currentUserCanUseFeature('GROUP_CHAT');

    if (featureFlagStatus !== 'LIVE') {
      return null;
    }

    const currentPerson = await Auth.getCurrentPerson();
    const resolvedType = this.resolveType(root);
    const globalId = createGlobalId(root.id, resolvedType);
    const channelId = crypto.SHA1(globalId).toString();

    const groupMembers = await this.getMembers(root.id);
    const members = groupMembers
      ? groupMembers.map((member) => StreamChat.getStreamUserId(member.id))
      : [];

    const groupLeaders = await this.getLeaders(root.id);
    const leaders = groupLeaders
      ? groupLeaders.map((leader) => StreamChat.getStreamUserId(leader.id))
      : [];

    // Create any Stream users that might not exist
    // We need to do this before we can create a channel 🙄
    await StreamChat.createStreamUsers({
      users: groupMembers.map(StreamChat.getStreamUser),
    });

    // Make sure the channel exists.
    // If it doesn't, create it.
    await StreamChat.getChannel({
      channelId,
      channelType: CHANNEL_TYPE,
      options: {
        members,
        created_by: StreamChat.getStreamUser(currentPerson),
      },
    });

    // Add group members not in channel
    await StreamChat.addMembers({
      channelId,
      groupMembers: members,
      channelType: CHANNEL_TYPE,
    });

    // Remove channel members not in group
    await StreamChat.removeMembers({
      channelId,
      groupMembers: members,
      channelType: CHANNEL_TYPE,
    });

    // Promote/demote members for moderation if necessary
    await StreamChat.updateModerators({
      channelId,
      groupLeaders: leaders,
      channelType: CHANNEL_TYPE,
    });

    return {
      id: root.id,
      channelId,
    };
  };

  resolveType({ groupTypeId, id }) {
    // if we have defined an ContentChannelTypeId based maping in the YML file, use it!
    if (
      Object.values(ROCK_MAPPINGS.GROUP_ITEM).some(
        ({ GroupTypeId }) => GroupTypeId && GroupTypeId.includes(groupTypeId)
      )
    ) {
      return Object.keys(ROCK_MAPPINGS.GROUP_ITEM).find((key) => {
        const value = ROCK_MAPPINGS.GROUP_ITEM[key];
        return value.GroupTypeId && value.GroupTypeId.includes(groupTypeId);
      });
    }
    // if we have defined a GroupId based maping in the YML file, use it!
    if (
      Object.values(ROCK_MAPPINGS.GROUP_ITEM).some(
        ({ GroupId }) => GroupId && GroupId.includes(id)
      )
    ) {
      return Object.keys(ROCK_MAPPINGS.GROUP_ITEM).find((key) => {
        const value = ROCK_MAPPINGS.GROUP_ITEM[key];
        return value.GroupId && value.GroupId.includes(id);
      });
    }

    return 'Group';
  }
}
