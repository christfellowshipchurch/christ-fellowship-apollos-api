import ApollosConfig from '@apollosproject/config';
import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import {
  createGlobalId,
  createCursor,
  parseCursor,
  parseGlobalId,
} from '@apollosproject/server-core';

import { graphql } from 'graphql';
import { get, isNull, isEmpty, filter, head, flatten, take, uniqBy } from 'lodash';
import { parseISO, isFuture, isToday } from 'date-fns';
import moment from 'moment';
import momentTz from 'moment-timezone';
import crypto from 'crypto-js';

import { getIdentifierType } from '../utils';
const { createImageUrlFromGuid } = Utils;

const { GROUP, DEFINED_TYPES } = ROCK_MAPPINGS;
const { LEADER_ROLE_IDS } = GROUP;
const {
  GROUP_MEMBER_ROLES,
  GROUP_TYPES,
  VOLUNTEER_GROUP_TYPES,
  GROUP_FINDER_TYPES,
  EXCLUDE_GROUPS,
  EXCLUDE_VOLUNTEER_GROUPS,
} = DEFINED_TYPES;
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
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });
  };

  getMembers = async (groupId) => {
    const { Person } = this.context.dataSources;
    const members = await this.request('GroupMembers')
      .andFilter(`GroupId eq ${groupId}`)
      .andFilter('GroupRole/IsLeader eq false')
      .andFilter(`GroupMemberStatus eq '1'`)
      .get();
    const uniqueMembers = uniqBy(members, 'personId');
    return Promise.all(uniqueMembers.map(({ personId }) => Person.getFromId(personId)));
  };

  getLeaders = async (groupId) => {
    const { Person } = this.context.dataSources;
    const members = await this.request('GroupMembers')
      .filter(`GroupId eq ${groupId}`)
      .andFilter('GroupRole/IsLeader eq true')
      .andFilter(`GroupMemberStatus eq '1'`)
      .expand('GroupRole')
      .get();
    const uniqueMembers = uniqBy(members, 'personId');
    const leaders = await Promise.all(
      uniqueMembers.map(({ personId }) => Person.getFromId(personId))
    );
    return leaders.length ? leaders : null;
  };

  getSearchIndex() {
    return this.context.dataSources.Search.index('Groups');
  }

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

  getByPerson = async ({ personId, asLeader = false, groupTypeIds = [] }) => {
    const { Cache, Schedule } = this.context.dataSources;
    const excludeList = await this._getExcludedGroupIds();

    const request = async () => {
      /**
       * Get the active groups that the person is a member of.
       * Conditionally filter that list of groups on whether or not your role in that group is that of "Leader".
       */
      const nestedArray = await Promise.all([
        this.getValidGroupTypeIds(),
        this.getValidVolunteerGroupTypeIds(),
      ]);
      const _groupTypeIds = flatten(nestedArray);

      /**
       * TL;DR Filter out any Group Types that don't have a valid Role Id
       *
       * To make the request even more specific, we only want to make a request to Rock for Groups Associations in which our user has a valid Role and a Valid Group Type.
       *
       * As a secondary check for the sake of performance, we'll confirm that every Group Type has at least 1 valid Member Role before making the request.
       *
       * We will also take into consideration whether our request should limit to just Groups in which the user is a leader of. If `asLeader` is true, we filter to _only_ Member Roles that are marked in Rock as Leader Roles. Otherwise, we'll use all valid roles.
       */
      let validRoles = await this._getValidGroupRoles();
      if (asLeader) {
        validRoles.filter(({ isLeader }) => isLeader);
      }

      const validGroupTypeIds = _groupTypeIds.filter((id) =>
        validRoles.find(({ groupTypeId }) => groupTypeId === id)
      );

      const groupAssociationRequests = await Promise.all(
        validGroupTypeIds.map((id) => {
          const groupTypeRoles = validRoles.filter(
            ({ groupTypeId }) => groupTypeId === id
          );

          return (
            this.request('GroupMembers')
              .filter(`PersonId eq ${personId}`)
              // Do not include groups where user's status is Inactive or Pending
              .andFilter(`GroupMemberStatus ne 'Inactive'`)
              .andFilter(`GroupMemberStatus ne 'Pending'`)
              // Check for the appropriate GroupRole
              .andFilter(
                groupTypeRoles.map(({ id }) => `(GroupRoleId eq ${id})`).join(' or ')
              )
              .expand('GroupRole')
              .get()
          );
        })
      );

      const groupAssociations = flatten(groupAssociationRequests);

      return groupAssociations.map(({ groupId, groupRoleId, groupRole }) => ({
        groupId,
        isLeader: !!validRoles.find(({ id, isLeader }) => groupRoleId === id && isLeader),
        groupTypeId: groupRole?.groupTypeId,
      }));
    };

    let groupIds = await Cache.request(request, {
      key: Cache.KEY_TEMPLATES.personGroups`${personId}`,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });

    /**
     * Filter by our exclude list and our Group Type Ids
     *
     * We have to do this here because there are too many exclusions for OData to handle and we also want to make sure that we filter the list _after_ pulling from the cache so that we don't accidentally cache a filtered list
     */

    groupIds = groupIds
      .filter(({ groupId }) => !excludeList.includes(groupId))
      .filter(
        ({ groupTypeId }) =>
          groupTypeIds.length === 0 || groupTypeIds.includes(groupTypeId)
      );

    /**
     * [{ id: String, leaders: Boolean }]
     *
     * While it's not the prettiest way to handle filtering out groups with no leaders, it's more than likely that Group Leaders are cached in Redis, so we should be ok to just check to see if we have any leaders to filter the group
     */
    const validGroupLeaders = await Promise.all(
      groupIds.map(({ groupId, isLeader }) => {
        const filter = async () => {
          if (isLeader)
            return {
              id: groupId,
              leaders: true,
            };

          const leaders = await this.getLeaders(groupId);

          return {
            id: groupId,
            leaders: Array.isArray(leaders) && leaders.length > 0,
          };
        };

        return filter();
      })
    );

    // Get the actual group data for the groups above.
    const groups = await Promise.all(
      groupIds
        // Filter out Groups that don't have any leaders
        .filter(({ groupId }) => {
          return validGroupLeaders.find(({ id, leaders }) => groupId === id && leaders);
        })
        // Temp solution for protected group ids
        .filter(({ groupId }) => !EXCLUDE_IDS.includes(groupId))
        // If `asLeader`, return only those you are a leader of, otherwise return everything
        .filter(({ isLeader }) => {
          if (asLeader) return isLeader;
          return true;
        })
        .map(({ groupId: id }) => this.getFromId(id))
    );

    /**
     * [{ id: String, schedule: Boolean }]
     *
     * While it's not the prettiest way to handle checking group schedules, it's more than likely that Schedules are cached in Redis, so we should be ok to just pull the schedule, parse it, and then check the date.
     */

    const validGroupSchedules = await Promise.all(
      groups.map(({ id, scheduleId }) => {
        const filter = async () => {
          let schedule = false;
          /**
           * If there is a Schedule Id on the Group, we can just go ahead and check for a Schedule from a Location attached on the Group.
           */
          const scheduleIsValid = (s) => {
            if (s && s.nextStart) {
              const { nextStart } = s;
              const parsedDate = parseISO(nextStart);

              return isToday(parsedDate) || isFuture(parsedDate);
            }
          };
          if (scheduleId) {
            const parsedSchedule = await Schedule.parseById(scheduleId);

            schedule = scheduleIsValid(parsedSchedule);
          } else {
            const locations = await this.getLocations(id);

            /**
             * We're gonna use a simple For Loop here cause we can really easily exit it once we find at least 1 valid schedule
             */
            for (var i = 0; i < locations.length; i++) {
              const location = locations[i];
              const { schedules } = location;

              for (var j = 0; j < schedules.length; j++) {
                const s = schedules[j];
                const parsedSchedule = await Schedule.parse(s);

                schedule = scheduleIsValid(parsedSchedule);

                if (schedule) break;
              }

              if (schedule) break;
            }
          }

          return {
            id,
            schedule,
          };
        };

        return filter();
      })
    );

    // Filter the groups to make sure we only pull those that are
    // active and NOT archived
    const filteredGroups = groups
      .filter((group) => group && group.isActive && !group.isArchived)
      // Filter out Groups that don't have a valid schedule
      .filter(({ id: groupId }) => {
        return validGroupSchedules.find(({ id, schedule }) => groupId === id && schedule);
      });

    return filteredGroups;
  };

  /**
   * Get Locations
   * Gets the Rock Group Locations with Schedules for a given Group Id. Results filtered to only include the 'Web and App' location in Rock.
   * @param {Integer} id | Rock Group Id
   */
  getLocations(id) {
    const { Cache } = this.context.dataSources;
    const request = () => {
      return this.request('/GroupLocations')
        .filter(`GroupId eq ${id}`)
        .andFilter(`LocationId eq ${ROCK_MAPPINGS.LOCATION_IDS.WEB_AND_APP}`)
        .expand('Schedules')
        .get();
    };

    return Cache.request(request, {
      expiresIn: 60 * 60 * 12, // 12 hour cache
      key: Cache.KEY_TEMPLATES.groupLocations`${id}`,
    });
  }

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

    /**
     * Cache the Person Id's for the current group based on the Group Members
     * Table.
     *
     * It's kind of naive, but the cache is super specific and will take into
     * consideration the id, isLeader flag, first, and skip (from the cursor).
     * This could likely be streamlined at some point in time, but I'm fairly
     * confident that Rock could not handle the load of grabbing more than ~40
     * group members, so let's not push it unnecessarily.
     */
    const personIdsCursor = this.request('GroupMembers')
      .filter(`GroupId eq ${id}`)
      .andFilter(`GroupRole/IsLeader eq ${isLeader}`)
      .andFilter(`GroupMemberStatus eq '1'`)
      .expand('GroupRole, Person')
      .top(first)
      .skip(skip)
      .transform((results) => {
        const resultIds = results
          .filter((groupMember) => {
            return !!groupMember.person;
          })
          .map(({ person }) => person.id);
        return uniqBy(resultIds);
      });

    const { Cache } = this.context.dataSources;
    const cachedKey = `group_member_ids_${id}_${isLeader}_${first}_${skip}`;
    const personIds = await Cache.request(() => personIdsCursor.get(), {
      key: cachedKey,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });

    return {
      getTotalCount: personIdsCursor.count,
      edges: personIds.map((id, i) => ({
        node: this.context.dataSources.Person.getFromId(id),
        cursor: createCursor({ position: i + skip }),
      })),
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

  getPreference({ attributeValues }) {
    return get(attributeValues, 'preference.valueFormatted', null);
  }

  getSubPreference({ attributeValues }) {
    return get(attributeValues, 'subPreference.valueFormatted', null);
  }

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

  getStreamChatChannel = async (root) => {
    // TODO : break up this logic and move it to the StreamChat DataSource
    const { Auth, StreamChat, Flag } = this.context.dataSources;
    const featureFlagStatus = await Flag.currentUserCanUseFeature('GROUP_CHAT');
    const CHANNEL_TYPE = StreamChat.channelType.GROUP;

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
      channelType: CHANNEL_TYPE,
    };
  };

  resolveType({ groupTypeId, id }) {
    // if we have defined an ContentChannelTypeId based mapping in the YML file, use it!
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
    // if we have defined a GroupId based mapping in the YML file, use it!
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

  /**
   * Get Valid Group Type Ids
   * Gets the Group Type Ids for the Defined Type `GROUP_TYPES`
   * @returns {[Integer]}
   */
  getValidGroupTypeIds = () => this._getGroupTypesFromDefinedType(GROUP_TYPES);

  /**
   * Get Valid Volunteer Group Type Ids
   * Gets the Group Type Ids for the Defined Type `VOLUNTEER_GROUP_TYPES`
   * @returns {[Integer]}
   */
  getValidVolunteerGroupTypeIds = () =>
    this._getGroupTypesFromDefinedType(VOLUNTEER_GROUP_TYPES);

  /**
   * Get Valid Group Finder Type Ids
   * Gets the Group Type Ids for the Defined Type `GROUP_FINDER_TYPES`
   * @returns {[Integer]}
   */
  getValidGroupFinderTypeIds = () =>
    this._getGroupTypesFromDefinedType(GROUP_FINDER_TYPES);

  /**
   * Private Get Group Types from Defined Type
   * This method uses a Defined Type Id and fetches those Defined Values. It then looks for an attribute called `groupTypes` and returns the Id for that Group Type.
   * @param {Integer} id
   * @returns {[Integer]}
   */
  async _getGroupTypesFromDefinedType(id) {
    const { Cache, DefinedValueList } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getFromId(id);

    const request = async () => {
      return Promise.all(
        definedValues.map((item) => {
          const groupTypeId = get(item, 'attributeValues.groupType.value');

          if (groupTypeId) {
            const identifier = getIdentifierType(groupTypeId);

            return this.request('GroupTypes')
              .filter(identifier.query)
              .transform((results) => results[0]?.id)
              .get();
          }

          return () => null;
        })
      );
    };

    const ids = await Cache.request(request, {
      expiresIn: 60 * 60 * 24, // 24 hour cache
      key: Cache.KEY_TEMPLATES.groupTypeIds`${id}`,
    });

    return ids;
  }

  async _getValidGroupRoles() {
    const { Cache, DefinedValueList } = this.context.dataSources;
    const request = async () => {
      const { definedValues } = await DefinedValueList.getFromId(GROUP_MEMBER_ROLES);
      const memberRoles = await Promise.all(
        definedValues.map((definedValue) => {
          const attributeValue = get(definedValue, 'attributeValues.groupRole.value');
          const identifier = getIdentifierType(attributeValue);
          return this.request('GroupTypeRoles')
            .filter(identifier.query)
            .transform((results) => ({
              id: results[0]?.id,
              isLeader: results[0]?.isLeader,
              groupTypeId: results[0]?.groupTypeId,
            }))
            .get();
        })
      );

      return memberRoles;
    };

    return Cache.request(request, {
      expiresIn: 60 * 60 * 24, // 24 hour cache
      key: Cache.KEY_TEMPLATES.groupRoles,
    });
  }

  async _getExcludedGroupIds() {
    const { Cache } = this.context.dataSources;
    const request = async () => {
      // Group Ids will be set to the  `value` property of the Defined Value in Rock
      return this.request('DefinedValues')
        .filter(`DefinedTypeId eq ${EXCLUDE_GROUPS}`)
        .orFilter(`DefinedTypeId eq ${EXCLUDE_VOLUNTEER_GROUPS}`)
        .transform((results) => results.map((result) => get(result, 'value')))
        .get();
    };

    return Cache.request(request, {
      expiresIn: 60 * 60 * 24, // 24 hour cache
      key: Cache.KEY_TEMPLATES.groupExcludeIds,
    });
  }

  // :: Search Indexing
  // --------------------------------------------------------------------------

  // Note: The input `group` may have aliased fields etc, as it is assumed
  // to be passed from a specialized query and not raw Rock object/data.
  async mapItemForIndex(groupId) {
    const globalId = typeof groupId === 'number' ?
    createGlobalId(groupId, 'Group')
    : groupId
    console.log('🔀 Mapping item for indexing... groupId: ', groupId, `( "${globalId}" )`);

    const getGroupQuery = `
      query getGroup {
        node(id: "${globalId}") {
          __typename
          id
          ... on Group {
            title
            summary
            coverImage { sources { uri } }
            campus {
              id
              name
            }
            preference
            subPreference
          }
        }
      }
    `;

    const { data, error } = await graphql(this.context.schema, getGroupQuery, {}, this.context);

    if (error) {
      console.log('❌ error: ', error);
      return null;
    }

    const {
      id,
      campus,
      coverImage,
      preference,
      subPreference,
      summary,
      title,
    } = data.node;

    // Remember — Algolia uses the order of attributes on items in its results
    // ranking logic, in lieu of other settings/custom ranking formula, etc.
    // @see https://www.algolia.com/doc/guides/managing-results/must-do/searchable-attributes/#ordering-your-attributes
    // @see https://www.algolia.com/doc/guides/managing-results/must-do/custom-ranking/#custom-ranking
    const groupForIndex = {
      id,
      // ? Is there any real value in storing presentation-only props in Algolia?
      // ? Should we refactor this and ContentItem indexing / SearchResult to remove cover image?
      // Searchable properties
      campusName: campus?.name,
      preference,
      subPreference,
      title,
      summary,
      coverImage, // Presentation only
    };

    console.log('groupForIndex:', groupForIndex);
    return groupForIndex;
  }

  async updateIndexGroup(id) {
    const groupForIndex = await this.mapItemForIndex(id);

    // TODO: Better error handling? Should this throw?
    if (!groupForIndex) {
      return `Error fetching data to index for Group "${id}"`
    }

    console.log('Item to index => ', JSON.stringify(groupForIndex, null, 2));
    return true;
  }

  searchGroups(args) {
    console.log('[GroupItem] searching for groups, request args:', args);
    const { query, first, after } = args;

    // TODO: These little utils could be centralized to somewhere else
    // ✂️ -------------------------------------------------------------------------------
    const namedValue = (prefix, string) => `${prefix}:"${string}"`;
    const prefixValues = (prefix, array) => {
      if (isEmpty(array)) return;
      return array.map(value => namedValue(prefix, value));
    };

    const group = (string) => string ? `(${string})` : undefined;
    const joinValues = (strings, conditional) => {
      if (isEmpty(strings) || !conditional) {
        return undefined;
      }

      return strings
        .filter(str => typeof str !== 'undefined')
        .join(conditional)
    };
    const oneOf = (strings) => group(joinValues(strings, ' OR '));
    const andList = (strings) => joinValues(strings, ' AND ');

    // createFilterString({ colors: ["red", "blue"], sizes: ["MD", "LG", "XL"] })
    // --> '(color:"red" OR color:"blue") AND (sizes:"MD" OR sizes:"LG" OR sizes:"XL")'
    const createFilterString = (filters) => {
      const campusNames = prefixValues('campusName', filters.campusNames);
      const preferences = prefixValues('preference', filters.preferences);
      const subPreferences = prefixValues('subPreference', filters.subPreferences);

      // ( preferences )
      // ( campusNames ) AND ( subPreferences )
      // ( campusNames ) AND ( preferences ) AND ( subPreferences )
      return andList([
        oneOf(campusNames),
        oneOf(preferences),
        oneOf(subPreferences)
      ]);
    };
    // ✂️ -------------------------------------------------------------------------------

    const searchParams = {
      query: query.text,
      filters: createFilterString(query),
      first,
      after,
    }

    console.log('🔍 Algolia searchParams:', searchParams);
    return this.getSearchIndex().byPaginatedQuery(searchParams);
  }

  // ⚠️ TEMPORARY FOR SAMPLE DATA ⚠️
  // ~330 Rock group IDs from existing group finder wide-open / unrefined search
  sampleGroupIds = [1018844, 989451, 1088929, 1042306, 1085234, 986154, 984069, 244464, 1085583, 1089364, 978042, 856506, 980089, 1089146, 241779, 1042960, 1020415, 841914, 242491, 1048468, 957695, 1091536, 1085830, 1017554, 1089363, 841609, 979605, 862655, 912983, 241822, 242275, 261655, 888876, 242121, 1060973, 257426, 1092643, 1088403, 1042734, 1034190, 241745, 956591, 956595, 956596, 956597, 1041270, 1041283, 888595, 1049473, 261284, 255407, 1044021, 1036416, 1036417, 243645, 853039, 1088930, 242146, 843488, 1088938, 242185, 242135, 242128, 242147, 242119, 1088943, 1085063, 977945, 1065574, 1088941, 1088940, 1088942, 979689, 1085190, 981243, 256030, 1003685, 242553, 1041150, 1055949, 774596, 888914, 253409, 242000, 268435, 971326, 1047257, 252151, 993779, 1059173, 1022729, 242011, 820128, 827354, 1039692, 998266, 242397, 242166, 242390, 1042735, 254430, 984014, 822846, 254394, 241867, 242303, 980848, 252993, 242167, 1055679, 1087922, 1085254, 1089274, 984290, 1052975, 242386, 1088626, 1088640, 1042076, 912148, 783712, 1046898, 1085189, 887021, 1075108, 1043768, 981236, 993368, 241955, 769561, 1016406, 1003560, 1086550, 1003185, 258445, 249749, 1042394, 241889, 1039842, 837223, 986728, 241797, 248719, 1016719, 798560, 919062, 864376, 1085191, 1088594, 996674, 996615, 242277, 242424, 1092642, 1085205, 1042551, 1091235, 967786, 1091150, 993655, 960273, 971095, 1086384, 837224, 1058546, 1044414, 1088407, 845467, 1090940, 1075112, 242370, 1071361, 1085353, 969049, 975937, 1075135, 1065949, 796066, 1054536, 269099, 982803, 796781, 828107, 242533, 1043712, 869365, 257436, 970201, 1071205, 825257, 241965, 1040007, 242384, 992195, 915661, 1020133, 827961, 250954, 969959, 770849, 988788, 1090883, 1046888, 1054194, 1042730, 890771, 242513, 241622, 1040000, 1082198, 1018675, 1003892, 261288, 1058556, 851312, 1042336, 1085817, 767547, 1085816, 867023, 242270, 1057996, 820149, 1044077, 267101, 998641, 1042520, 241808, 843821, 1045509, 259034, 241899, 1085552, 264063, 1085584, 1089369, 1068794, 998371, 874887, 774879, 1039833, 1046973, 1091066, 1091172, 252904, 256438, 1039941, 770826, 1038611, 1091151, 1064012, 1088885, 267931, 269222, 242070, 1042550, 241740, 894706, 893447, 1089659, 243380, 241838, 1062496, 241795, 971094, 983440, 827349, 979794, 804727, 1070235, 1088937, 1088939, 1088935, 1043387, 1091511, 241986, 242803, 1053794, 765428, 980852, 1088944, 849366, 1038429, 241807, 961932, 242173, 1033290, 857097, 1042549, 246020, 1085238, 1088329, 258119, 767125, 264101, 1051433, 1085557, 1088432, 986388, 981164, 802315, 1088786, 761313, 1041919, 903591, 1089262, 1089266, 1091065, 984068, 1075113, 1041151, 983589, 983458, 1017713, 983588, 1041154, 983520, 983519, 1041156, 983525, 1041157, 983524, 1044108, 983521, 1041160, 983522, 1041161, 1042694, 1042695, 1041155, 983526];

  async updateIndexAllGroups() {
    console.log('[GroupItem] indexing "all" groups');
    console.log('•••••••• 🛑 SAFETY SWITCH ••••••••');
    return null;
    const alreadyIndexedCount = 101;
    const sampleCount = 50;

    const groups = this.sampleGroupIds.slice(alreadyIndexedCount + 1, alreadyIndexedCount + sampleCount);
    console.log('group ids to index:', groups);
    const groupsForIndex = await Promise.all(
      groups.map(id => this.mapItemForIndex(id))
    );

    console.log('groupsForIndex:', groupsForIndex);

    return this.getSearchIndex().addObjects(groupsForIndex);
  }
}
