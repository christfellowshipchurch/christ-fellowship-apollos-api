import ApollosConfig from '@apollosproject/config';
import { Group as baseGroup, Utils } from '@apollosproject/data-connector-rock';
import {
  createGlobalId,
  createCursor,
  parseCursor,
  parseGlobalId,
} from '@apollosproject/server-core';

import { graphql } from 'graphql';
import {
  get,
  isNull,
  isNil,
  isEmpty,
  filter,
  head,
  flatten,
  take,
  uniqBy,
  zipObject,
} from 'lodash';
import { parseISO, isFuture, isToday, differenceInHours, sub } from 'date-fns';
import moment from 'moment';
import momentTz from 'moment-timezone';
import crypto from 'crypto-js';

import { getIdentifierType } from '../utils';

const { createImageUrlFromGuid } = Utils;

const { ROCK_MAPPINGS } = ApollosConfig;
const { DEFINED_TYPES } = ROCK_MAPPINGS;
const {
  GROUP_MEMBER_ROLES,
  GROUP_TYPES,
  VOLUNTEER_GROUP_TYPES,
  GROUP_FINDER_TYPES,
  EXCLUDE_GROUPS,
  EXCLUDE_VOLUNTEER_GROUPS,
} = DEFINED_TYPES;

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
    return Promise.all(
      uniqueMembers.map(({ personId }) => Person.getFromId(personId))
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
    const uniqueMembers = uniqBy(members, 'personId');
    const leaders = await Promise.all(
      uniqueMembers.map(({ personId }) => Person.getFromId(personId))
    );
    return leaders.length ? leaders : null;
  };

  getSearchIndex() {
    return this.context.dataSources.Search.index('GROUPS');
  }

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

    return null;
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

    return images.definedValues.map((image) => ({
      guid: image.attributeValues.image.value,
      name: image.value, // The attribute value's name/label at top level
      image: ContentItem.getImages(image)[0],
    }));
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

    return null;
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
        data.TargetEntityTypeId =
          ApollosConfig.ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM;
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

    return null;
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

    return null;
  }

  async removeResource({ groupId, relatedNodeId }) {
    if (!groupId || !relatedNodeId) return null;

    try {
      const { Auth } = this.context.dataSources;
      const currentPerson = await Auth.getCurrentPerson();

      const groupGlobalId = parseGlobalId(groupId)?.id;
      if (this.userIsLeader(groupGlobalId, currentPerson.id)) {
        const entity = await this.groupResourceEntity({
          groupId,
          relatedNodeId,
        });
        if (entity) {
          await this.delete(`/RelatedEntities/${entity.id}`);
          return this.updateCache(groupGlobalId);
        }
      }

      return null;
    } catch (e) {
      console.log(e);
    }

    return null;
  }

  async groupResourceEntity({ groupId, relatedNodeId }) {
    const groupGlobalId = parseGlobalId(groupId)?.id;
    const relatedNodeGlobalId = parseGlobalId(relatedNodeId);
    let targetEntityId = null;

    let entityTypeId;
    switch (relatedNodeGlobalId.__type) {
      case 'Url':
        const jsonNode = JSON.parse(relatedNodeGlobalId.id);
        targetEntityId = jsonNode.id;
        entityTypeId = ApollosConfig.ROCK_ENTITY_IDS.DEFINED_VALUE;
        break;
      case 'MediaContentItem':
        entityTypeId = ApollosConfig.ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM;
        targetEntityId = relatedNodeGlobalId.id;
        break;
      default:
        break;
    }
    if (entityTypeId && targetEntityId) {
      return this.request('/RelatedEntities')
        .filter(`SourceEntityTypeId eq ${ApollosConfig.ROCK_ENTITY_IDS.GROUP}`)
        .andFilter(`SourceEntityId eq ${groupGlobalId}`)
        .andFilter(`QualifierValue eq 'APOLLOS_GROUP_RESOURCE'`)
        .andFilter(`TargetEntityTypeId eq ${entityTypeId}`)
        .andFilter(`TargetEntityId eq ${targetEntityId}`)
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
      const validRoles = await this._getValidGroupRoles();
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
                groupTypeRoles
                  .map(
                    ({ id: groupRoleId }) => `(GroupRoleId eq ${groupRoleId})`
                  )
                  .join(' or ')
              )
              .expand('GroupRole')
              .get()
          );
        })
      );

      const groupAssociations = flatten(groupAssociationRequests);

      return groupAssociations.map(({ groupId, groupRoleId, groupRole }) => ({
        groupId,
        isLeader: !!validRoles.find(
          ({ id, isLeader }) => groupRoleId === id && isLeader
        ),
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
        const filterGroupIds = async () => {
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

        return filterGroupIds();
      })
    );

    // Get the actual group data for the groups above.
    const _groups = await Promise.all(
      groupIds
        // Filter out Groups that don't have any leaders
        .filter(({ groupId }) =>
          validGroupLeaders.find(({ id, leaders }) => groupId === id && leaders)
        )
        // Temp solution for protected group ids
        .filter(({ groupId }) => !EXCLUDE_IDS.includes(groupId))
        // If `asLeader`, return only those you are a leader of, otherwise return everything
        .filter(({ isLeader }) => {
          if (asLeader) return isLeader;
          return true;
        })
        .map(({ groupId: id }) => this.getFromId(id))
    );

    // Standard Group Filtering
    // note : we do this here because we have to do a more comprehensive filter of schedules and just want to work with the simplest collection of Groups we can before we get to the more complex operations
    const groups = _groups.filter(
      (group) => group && group.isActive && !group.isArchived
    );

    /**
     * [{ id: String, schedule: Boolean }]
     *
     * While it's not the prettiest way to handle checking group schedules, it's more than likely that Schedules are cached in Redis, so we should be ok to just pull the schedule, parse it, and then check the date.
     */

    const validGroupSchedules = await Promise.all(
      groups.map(({ id, scheduleId }) => {
        const filterGroupSchedules = async () => {
          try {
            let schedule = false;
            /**
             * If there is a Schedule Id on the Group, we can just go ahead and check for a Schedule from a Location attached on the Group.
             */
            // eslint-disable-next-line consistent-return
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
              for (let i = 0; i < locations.length; i += 1) {
                const location = locations[i];
                const { schedules } = location;

                for (let j = 0; j < schedules.length; j += 1) {
                  const s = schedules[j];
                  // eslint-disable-next-line no-await-in-loop
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
          } catch (e) {
            console.warn(
              `[Group.getByPerson] could not validate schedule ${scheduleId} for group ${id}`
            );
            console.warn(`[Group.getByPerson] cont`, e);
          }

          return {
            id: null,
            schedule: null,
          };
        };

        return filterGroupSchedules();
      })
    );

    const filteredGroups = groups
      // Filter out Groups that don't have a valid schedule
      .filter(({ id: groupId }) =>
        validGroupSchedules.find(
          ({ id, schedule }) => groupId === id && schedule
        )
      );

    return filteredGroups;
  };

  /**
   * Get Locations
   * Gets the Rock Group Locations with Schedules for a given Group Id. Results filtered to only include the 'Web and App' location in Rock.
   * @param {Integer} id | Rock Group Id
   */
  getLocations(id) {
    const { Cache } = this.context.dataSources;
    const request = () =>
      this.request('/GroupLocations')
        .filter(`GroupId eq ${id}`)
        .andFilter(`LocationId eq ${ROCK_MAPPINGS.LOCATION_IDS.WEB_AND_APP}`)
        .expand('Schedules')
        .get();

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
    this.request('ContentChannelItems')
      .filter(getIdentifierType(id).query)
      .first();

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
                const definedValue = await Url.getFromMasterList(
                  targetEntityId
                );

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

    const filterResources = groupResources
      .map((f) => `(Id ne ${f.targetEntityId})`)
      .join(' and ');

    return this.request('/ContentChannelItems')
      .filter(`ContentChannelId eq 79`)
      .andFilter(filterResources);
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
          .filter((groupMember) => !!groupMember.person)
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
      edges: personIds.map((personId, i) => ({
        node: this.context.dataSources.Person.getFromId(personId),
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
      const avatars = [];
      filteredMembers.map((member) =>
        member.photo.guid
          ? avatars.push(createImageUrlFromGuid(member.photo.guid))
          : null
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
    return Promise.all(
      filteredMembers.map(({ id: memberId }) => this.getPhoneNumbers(memberId))
    ).then((values) => {
      const numbers = [];
      values.map((o) => (o && o.number ? numbers.push(o.number) : null));
      return numbers;
    });
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
        const nextMeetingTime = moment(nextStart).add(7, 'd').utc().format();
        return { start: nextMeetingTime, end: nextMeetingTime };
      }

      return { start: nextStart, end: nextStart };
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
    if (zoomLink !== '') {
      const { DefinedValue } = this.context.dataSources;
      // Parse Zoom Meeting links that have ids and/or passwords.
      const regexMeetingId = zoomLink.match(/j\/(\d+)/);
      const regexPasscode = zoomLink.match(/\?pwd=(\w+)/);

      // If url link does not match Zoom url pattern this will return the link string and meetingId and passcode will be null.
      const passcode = isNull(regexPasscode) ? null : regexPasscode[1];
      const meetingId = isNull(regexMeetingId) ? null : regexMeetingId[1];

      return {
        link: zoomLink,
        meetingId,
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
    if (zoomLink !== '') {
      const { DefinedValue } = this.context.dataSources;
      // Parse Zoom Meeting links that have ids and/or passwords.
      const regexMeetingId = zoomLink.match(/j\/(\d+)/);
      const regexPasscode = zoomLink.match(/\?pwd=(\w+)/);
      // If url link does not match Zoom url pattern this will return the link string and meetingId and passcode will be null.
      const passcode = isNull(regexPasscode) ? null : regexPasscode[1];
      const meetingId = isNull(regexMeetingId) ? null : regexMeetingId[1];
      return {
        link: zoomLink,
        meetingId,
        passcode,
        labelText: DefinedValue.getValueById(parentVideoCallLabelText),
      };
    }
    return null;
  };

  getPreferenceString = async (id) => {
    const { DefinedValue } = this.context.dataSources;

    const preference = await DefinedValue.getFromId(id);
    const titleOverride = get(
      preference,
      'attributeValues.titleOverride.value',
      undefined
    );
    const value = get(preference, 'value', null);
    return titleOverride || value;
  };

  async getPreference({ attributeValues }) {
    const preferenceId = attributeValues?.preference?.value;

    if (!preferenceId) {
      return null;
    }
    if (preferenceId.includes(',')) {
      const ids = preferenceId.split(',');
      const preferences = await Promise.all(
        ids.map((id) => this.getPreferenceString(id))
      );
      return preferences;
    }
    const preference = await this.getPreferenceString(preferenceId);
    return [preference];
  }

  getSubPreference = ({ attributeValues }) =>
    get(attributeValues, 'subPreference.valueFormatted', null);

  allowMessages = ({ attributeValues }) =>
    get(attributeValues, 'allowMessages.value', '');

  getTitle = ({ attributeValues, name }) => {
    const titleOverride = get(attributeValues, 'titleOverride.value', '');
    if (titleOverride !== '') {
      return titleOverride;
    }
    return name;
  };

  getMeetingType = ({ attributeValues }) =>
    get(attributeValues, 'meetingType.valueFormatted', '');

  getStreamChatChannel = async (root) => {
    let streamChatChannel;

    try {
      const { Auth, StreamChat } = this.context.dataSources;
      const channelType = StreamChat.channelType.GROUP;
      const groupType = this.resolveType(root);

      const groupName = this.getTitle(root);
      const currentPerson = await Auth.getCurrentPerson();
      const resolvedType = this.resolveType(root);
      const globalId = createGlobalId(root.id, resolvedType);
      const channelId = crypto.SHA1(globalId).toString();

      // Define the return value upfront
      streamChatChannel = {
        id: root.id,
        channelId,
        channelType,
      };

      // Get or create the channel. The options are only applied to the channel if
      // creating it for the first time. We'll update the values further down if necessary.
      const channel = await StreamChat.getChannel({
        channelId,
        channelType,
        options: {
          created_by: StreamChat.getStreamUser(currentPerson),
          name: groupName,
          lastSyncedWithRockAt: null,
        },
      });

      // Check to see if we need to sync the channel with Rock data.
      // If we don't, we can return early and avoid a bunch of work.
      const lastSyncedWithRockAt = channel?.data?.lastSyncedWithRockAt;

      if (lastSyncedWithRockAt) {
        const hoursAgo = differenceInHours(
          new Date(),
          new Date(lastSyncedWithRockAt)
        );

        if (hoursAgo <= 24) {
          return streamChatChannel;
        }
      }

      // We need to sync this group's data from Rock to Stream Chat.
      // First, members. Make sure all group members have Stream Chat users.
      const groupMembers = await this.getMembers(root.id);
      const members = groupMembers
        ? groupMembers.map((member) => StreamChat.getStreamUserId(member.id))
        : [];
      const groupLeaders = await this.getLeaders(root.id);
      const leaders = groupLeaders
        ? groupLeaders.map((leader) => StreamChat.getStreamUserId(leader.id))
        : [];

      // Stream will throw an error if you try to add arbitrary users to a channel.
      // We need to ensure the users exist in Stream first.
      await StreamChat.createStreamUsers({
        users: [...groupLeaders, ...groupMembers].map(StreamChat.getStreamUser),
      });

      // Add group members not in channel
      await StreamChat.addMembers({
        channelId,
        groupMembers: members,
        channelType,
      });

      // Remove channel members not in group
      await StreamChat.removeMembers({
        channelId,
        groupMembers: members,
        channelType,
      });

      // Promote/demote members for moderation as necessary
      await StreamChat.updateModerators({
        channelId,
        groupLeaders: leaders,
        channelType,
      });

      // todo : remove this once the mobile 6.0.2 version is released
      if (groupType === 'VolunteerGroup') {
        const hideVolunteerGroupForMembers = async () => {
          const channelMembers = await StreamChat.getChannelMembers({
            channelId,
            channelType,
          });
          Promise.all(
            // eslint-disable-next-line camelcase
            channelMembers.map(({ user_id }) => channel.hide(user_id))
          );
        };
        hideVolunteerGroupForMembers();
      }

      // Update the channel's data to match Rock, and mark that our sync is complete.
      await channel.updatePartial({
        set: {
          name: groupName,
          lastSyncedWithRockAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[GroupItem.getStreamChatChannel] Error!');
      console.error(error);
    }

    return streamChatChannel;
  };

  resolveType = ({ groupTypeId, id }) => {
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
  };

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

    const request = async () => {
      const { definedValues } = await DefinedValueList.getFromId(id);
      /**
       * 1. Map to Group Type Ids
       * 2. Filter out any falsy value
       * 3. Filter out duplicate Group Type Ids
       */
      const groupTypeIds = definedValues
        .map((definedValue) =>
          get(definedValue, 'attributeValues.groupType.value')
        )
        .filter((groupTypeId) => !!groupTypeId)
        .filter(
          (groupTypeId, index, self) => self.indexOf(groupTypeId) === index
        );

      return Promise.all(
        groupTypeIds.map((groupTypeId) => {
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

    // note : one last filter for falsy value
    return ids.filter((cacheId) => !!cacheId);
  }

  async _getValidGroupRoles() {
    const { Cache, DefinedValueList } = this.context.dataSources;
    const request = async () => {
      const { definedValues } = await DefinedValueList.getFromId(
        GROUP_MEMBER_ROLES
      );
      /**
       * 1. Map to Group Type Ids
       * 2. Filter out any falsy value
       * 3. Filter out duplicate Group Type Ids
       */
      const groupTypeRoles = definedValues
        .map((definedValue) =>
          get(definedValue, 'attributeValues.groupRole.value')
        )
        .filter((groupTypeRole) => !!groupTypeRole)
        .filter(
          (groupTypeRole, index, self) => self.indexOf(groupTypeRole) === index
        );

      const memberRoles = await Promise.all(
        groupTypeRoles.map((groupTypeRole) => {
          const identifier = getIdentifierType(groupTypeRole);
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
    const request = async () =>
      // Group Ids will be set to the  `value` property of the Defined Value in Rock
      this.request('DefinedValues')
        .filter(`DefinedTypeId eq ${EXCLUDE_GROUPS}`)
        .orFilter(`DefinedTypeId eq ${EXCLUDE_VOLUNTEER_GROUPS}`)
        .transform((results) => results.map((result) => get(result, 'value')))
        .get();
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
    const globalId =
      typeof groupId === 'number' ? createGlobalId(groupId, 'Group') : groupId;

    const getGroupQuery = `
      query getGroup {
        node(id: "${globalId}") {
          __typename
          id
          ... on Group {
            dateTime {
              start
            }
            title
            summary
            coverImage { sources { uri } }
            campus {
              id
              name
            }
            preference
            subPreference
            meetingType
          }
          ... on GroupItem {
            leaders: people(first: 20, isLeader: true) {
              edges {
                node {
                  id
                  firstName
                  lastName
                }
              }
            }
          }
        }
      }
    `;

    const { data, error } = await graphql(
      this.context.schema,
      getGroupQuery,
      {},
      this.context
    );

    if (error || !data.node) {
      console.log(
        `GroupItem.mapItemForIndex() Error mapping groupId ${groupId} for index `,
        error
      );
      return null;
    }

    const {
      id,
      campus,
      coverImage,
      dateTime,
      leaders,
      preference,
      subPreference,
      meetingType,
      summary,
      title,
    } = data.node;

    const dateTimeFormatted = moment(dateTime?.start).format('dddd');

    // Remember: Algolia uses the order of attributes on items in its results
    // ranking logic, in lieu of other settings/custom ranking formula, etc.
    // @see https://www.algolia.com/doc/guides/managing-results/must-do/searchable-attributes/#ordering-your-attributes
    // @see https://www.algolia.com/doc/guides/managing-results/must-do/custom-ranking/#custom-ranking
    const groupForIndex = {
      id,
      campusName: campus?.name,
      preference,
      subPreference,
      day: dateTimeFormatted === 'Invalid date' ? '' : dateTimeFormatted,
      title,
      summary,
      leaders:
        leaders?.edges?.map(
          ({ node }) => `${node.firstName} ${node.lastName}`
        ) || [],
      coverImage, // Presentation only
      meetingType,
    };

    return groupForIndex;
  }

  async updateIndexGroup(id) {
    const groupForIndex = await this.mapItemForIndex(id);

    // TODO: Better error handling? Should this throw?
    if (!groupForIndex) {
      console.log(`Error fetching data to index for Group "${id}"`);
      return false;
    }

    return true;
  }

  /**
   * This method is temporary for development purposes, hence all the safety switches
   */
  async updateIndexAllGroups() {
    console.log('\n[GroupItem] indexing all groups');
    console.log('---------------------------------------------------------');

    // Performing a dry run just prepares all the data for algolia
    // without actually touching the records/using operations.
    const DRY_RUN = true;

    const validGroupFinderTypeIds = await this.getValidGroupFinderTypeIds();
    const excludeList = await this._getExcludedGroupIds();

    const rawGroups = await this.request('Groups')
      .filter(`IsActive eq true`)
      .andFilter(`IsPublic eq true`)
      .andFilter(`IsArchived eq false`)
      // Only query valid group types for group finder
      .andFilter(
        validGroupFinderTypeIds
          .map((groupTypeId) => `GroupTypeId eq ${groupTypeId}`)
          .join(' or ')
      )
      .select(`Id, GroupTypeId, Name, CreatedDateTime, ModifiedDateTime`)
      .get();

    // Filter out excluded groups
    const filteredGroups = rawGroups.filter(
      // ! Be aware, excludeList ids are strings
      ({ id }) => !excludeList.includes(id.toString())
    );

    // console.log('filteredGroups:');
    // console.table(filteredGroups, [
    //   'id',
    //   'name',
    //   'groupTypeId',
    //   'createdDateTime',
    //   'modifiedDateTime',
    // ]);

    const groupIdsToIndex = filteredGroups.map(({ id }) => id);
    console.log(`🔍 Found ${groupIdsToIndex.length} groups that need indexed`);
    console.log('⌛ Mapping groups for index...');

    const groupsForIndex = await Promise.all(
      filteredGroups.map(({ id }) => this.mapItemForIndex(id))
    );

    console.log(`✅ Mapped ${groupsForIndex.length} groups for index`);

    if (DRY_RUN) {
      console.log('•••••••• 🙅‍♂️ DRY RUN, SKIPPING INDEX OPERATION 🙅‍♂️ ••••••••');
      return null;
    }

    // If development environment...
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test'
    ) {
      console.log('\n🚨🚨🚨 Preventing accidental index to Algolia! 🚨🚨🚨');
      console.log(
        'If you meant to actually perform operations in Algolia, open src/data/group-item/data-source.js and comment out the return after this log message.'
      );
      // Make sure to uncomment this again before committing/merging!
      return null;
    }

    await this.getSearchIndex().deleteAllObjects();
    return this.getSearchIndex().addObjects(
      groupsForIndex.filter((group) => !!group)
    );
  }

  searchGroups(args) {
    const { query, first, after } = args;
    /*
      query: {
        attributes: [
          { key: "campusNames", values: ["Royal Palm Beach", "Jupiter"] },
          { key: "preferences", values: ["Crew", "Co-ed"] }
        ]
      }
    */

    // TODO: These little utils could be centralized to somewhere else
    // ✂️ -------------------------------------------------------------------------------

    // prefixValue('topping', 'cheese')
    // --> 'topping:"cheese"'
    const prefixValue = (prefix, string) => `${prefix}:"${string}"`;

    // prefixValues('color', ['red, 'green', 'blue'])
    // --> ['color:"red"', 'color:"green", 'color:"blue"]
    const prefixValues = (prefix, array) => {
      if (isEmpty(array)) return undefined;
      return array.map((value) => prefixValue(prefix, value));
    };

    // group("pizza")
    // --> "(pizza)"
    const group = (string) => (string ? `(${string})` : undefined);

    // join(["not too hot", undefined, "not too cold", "not too lumpy"], ' AND ')
    // --> '"not too hot AND not too cold AND not too lumpy"'
    const join = (strings, conditional) => {
      if (isEmpty(strings) || !conditional) {
        return undefined;
      }

      return strings.filter((string) => !isNil(string)).join(conditional);
    };
    const oneOf = (strings) => group(join(strings, ' OR '));
    const allOf = (strings) => join(strings, ' AND ');

    // ✂️ -------------------------------------------------------------------------------

    // Get a query attribute by key from the input `query.attributes`
    const getQueryAttribute = (key) =>
      query?.attributes?.find((attribute) => attribute.key === key);

    // Return a query attribute's values prefixed with a string
    const prefixAttributeValues = ({ attributeKey, prefixString }) => {
      const attribute = getQueryAttribute(attributeKey);

      return attribute
        ? prefixValues(prefixString, attribute.values)
        : undefined;
    };

    const queryText = getQueryAttribute('text')?.values[0];
    const campusNames = prefixAttributeValues({
      attributeKey: 'campusNames',
      prefixString: 'campusName',
    });
    const preferences = prefixAttributeValues({
      attributeKey: 'preferences',
      prefixString: 'preference',
    });
    const subPreferences = prefixAttributeValues({
      attributeKey: 'subPreferences',
      prefixString: 'subPreference',
    });
    const days = prefixAttributeValues({
      attributeKey: 'days',
      prefixString: 'day',
    });
    const meetingType = prefixAttributeValues({
      attributeKey: 'meetingType',
      prefixString: 'meetingType',
    });

    // Something like:
    // (campusName:"Jupiter" OR campusName:"Royal Palm Beach") AND (preference:"Crew (Men)" OR preference:"Sisterhood")
    const filtersString = allOf([
      oneOf(campusNames),
      oneOf(days),
      oneOf(meetingType),
      oneOf(preferences),
      oneOf(subPreferences),
    ]);

    const searchParams = {
      query: queryText,
      filters: filtersString,
      first,
      after,
    };

    return this.getSearchIndex().byPaginatedQuery(searchParams);
  }

  getGroupSearchOptions = async () => {
    const facets = await this.getSearchIndex().byFacets();

    const groupSearchOptions = Object.keys(facets).map((key) =>
      Object.keys(facets[key])
    );

    return zipObject(Object.keys(facets), groupSearchOptions);
  };

  getGroupSearchFacetsAttributes = async () => {
    const facets = await this.getSearchIndex().byFacets();

    return Object.keys(facets);
  };

  getGroupFacetsByFilters = async (facet, facetFilters) => {
    const facets = await this.getSearchIndex().byFacetFilters(
      facet,
      facetFilters
    );
    return Object.keys(facets[facet]);
  };

  /**  :: Contact Group Leader
   * --------------------------------------------------------------------------
   * This workflow is triggered when a user clicks 'contact' leader
   *  @param {string}  groupId  Apollos Group id
   */

  contactLeader = async ({ groupId }) => {
    if (!groupId) return null;
    const groupGlobalId = parseGlobalId(groupId)?.id;

    try {
      const { Workflow, Auth } = this.context.dataSources;
      const currentUser = await Auth.getCurrentPerson();

      const workflow = await Workflow.trigger({
        id: ROCK_MAPPINGS.WORKFLOW_IDS.GROUP_CONTACT_LEADER,
        attributes: {
          personId: currentUser.id,
          groupId: groupGlobalId,
        },
      });
      return workflow.status;
    } catch (e) {
      console.log(e);
    }

    return null;
  };

  async loadGroups() {
    const { Cache } = this.context.dataSources;

    const loadGroupMembers = async (groupType, groupRoleIds) => {
      let total = 0;
      const groupTypeFilter = `GroupRole/GroupTypeId eq ${groupType}`;
      const groupRoleFilters = groupRoleIds.map(
        (groupRoleId) => `GroupRoleId eq ${groupRoleId}`
      );

      let skip = 0;
      const batch = 20;
      const count = await this.request('GroupMembers')
        .filterOneOf(groupRoleFilters)
        .andFilter(groupTypeFilter)
        .count();

      const memberMapper = async ({ personId }) => {
        try {
          await Cache.delete({
            key: Cache.KEY_TEMPLATES.personGroups`${personId}`,
          });
          await this.getByPerson({ personId });

          total += 1;
        } catch (e) {
          console.warn({ e });
        }
      };

      while (skip < count) {
        // eslint-disable-next-line no-await-in-loop
        const groupMembers = await this.request('GroupMembers')
          .filterOneOf(groupRoleFilters)
          .andFilter(groupTypeFilter)
          .top(batch)
          .skip(skip)
          .get();

        // eslint-disable-next-line no-await-in-loop
        await Promise.all(groupMembers.map(memberMapper));
        skip += batch;
      }

      return total;
    };

    const calculateTotalRequests = async (groupTypeIds, groupRoleIds) => {
      const groupRoleFilter = groupRoleIds.map(
        (id) => `(GroupRoleId eq ${id})`
      );

      const groupMemberPromises = Promise.all(
        groupTypeIds.map((id) =>
          this.request('GroupMembers')
            .filterOneOf(groupRoleFilter)
            .andFilter(`GroupRole/GroupTypeId eq ${id}`)
            .count()
        )
      );

      const groupMembers = await groupMemberPromises;
      const reducer = (accumulator, currentValue) => accumulator + currentValue;

      console.log(
        `[load groups cache] updating cache for ${groupMembers.reduce(
          reducer
        )} Group Members`
      );
    };

    let total = 0;
    const groupTypeIds = await this.getValidGroupTypeIds();
    const groupRoleIdObjects = await this._getValidGroupRoles();
    const groupRoleIds = groupRoleIdObjects.map(({ id }) => id);

    await calculateTotalRequests(groupTypeIds, groupRoleIds);

    for (let i = 0; i < groupTypeIds.length; i += 1) {
      const groupType = groupTypeIds[i];

      // eslint-disable-next-line no-await-in-loop
      total += await loadGroupMembers(groupType, groupRoleIds);
    }

    console.log(`[load groups cache] updated cache for ${total} Group Members`);
  }
}
