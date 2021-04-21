import ApollosConfig from '@apollosproject/config';
import * as RedisCache from '@apollosproject/data-connector-redis-cache';
import { PrayerRequest } from '@apollosproject/data-connector-rock';
import { keys, get } from 'lodash';
import { isRequired, isType } from '../utils';

const { ROCK_ENTITY_IDS, PAGE_BUILDER, ROCK_MAPPINGS } = ApollosConfig;
const { DEFINED_TYPES } = ROCK_MAPPINGS;
const { EXCLUDE_GROUPS, EXCLUDE_VOLUNTEER_GROUPS, GROUP_MEMBER_ROLES } = DEFINED_TYPES;

const parseKey = (key) => {
  if (Array.isArray(key)) {
    return key.join(':');
  }
  return key;
};

export default class Cache extends RedisCache.dataSource {
  DEFAULT_TIMEOUT = 60 * 60; // 1 hour cache

  KEY_TEMPLATES = {
    attributeMatrix: (_, id) => `attribute-matrix:${id}`,
    contentChannelItemIds: (_, id) => `content-channel-item-ids:${id}`,
    contentItem: (_, id) => `content-item:${id}`,
    contentItemGuidId: (_, guid) => `content-item-id:${guid}`,
    contentItemChildren: (_, id) => `content-item:${id}:children`,
    definedType: (_, id) => `defined-type:${id}`,
    definedValue: (_, id) => `defined-value:${id}`,
    definedValueGuidId: (_, guid) => `defined-value-id:${guid}`,
    eventContentItems: `event-content-items`,
    group: (_, id) => `group:${id}`,
    groupExcludeIds: `group-exclude-ids`,
    groupLocations: (_, id) => `group:locations:${id}`,
    groupRoles: `group-roles`,
    groupTypeIds: (_, id) => `group-type-collection:${id}`,
    linkTree: 'link-tree',
    liveStreamContentItems: `live-stream-content-items`,
    liveStreamRelatedNode: (_, id) => `liveStream-relatedNode-${id}`,
    liveStreams: `live-streams`,
    pathnameId: (_, pathname) => `${pathname}`,
    personas: (_, id) => `personas:${id}`,
    person: (_, id) => `person:${id}`,
    personAlias: (_, id) => `person-alias:${id}`,
    personPhoto: (_, id) => `person-photo:${id}`,
    personGroups: (_, personId) => `person-groups:${personId}`,
    personPrayers: (_, personId) => `person-prayer-requests:${personId}`,
    prayerRequest: (_, id) => `prayer-request:${id}`,
    rockConstant: (_, name) => `rock-constant:${name}`,
    rockFeed: (_, id) => `rock-feed:${id}`,
    schedule: (_, id) => `schedule:${id}`,
    scheduleGuidId: (_, guid) => `schedule-id:${guid}`,
  };

  initialize({ context }) {
    this.context = context;
  }

  get keyPrefix() {
    return `:${process.env.CONTENT}:`;
  }

  /**
   * Makes a request and return the cached value if it exists. If it does not exist in the cache, it will cache the value.
   * @param {function}  request         Async method whose return value gets cached.
   * @param {object}    args
   * @param {string}    args.key        Key for the value when stored in Redis.
   * @param {number}    args.expiresIn  The length of time that the cache should be set for.
   */
  async request(
    requestMethod = isRequired('Cache.request', 'requestMethod'),
    { key = isRequired('Cache.request', 'args.key'), expiresIn = this.DEFAULT_TIMEOUT }
  ) {
    if (
      isType(requestMethod, 'requestMethod', 'function') &&
      isType(key, 'key', 'string')
    ) {
      const _key = `${this.keyPrefix}${key}`;

      const cachedValue = await this.get({
        key: _key,
      });

      if (cachedValue) {
        return cachedValue;
      }

      const data = await requestMethod();

      if (data) {
        await this.set({
          key: _key,
          data,
          expiresIn,
        });
      }

      return data;
    }
  }

  async delete({ key }, callback) {
    return this.safely(() =>
      this.redis.del(parseKey(`${this.keyPrefix}${key}`), callback)
    );
  }

  async updateRockEntity({
    entityId = isRequired('Cache.updateRockEntity', 'entityId'),
    entityTypeId = isRequired('Cache.updateRockEntity', 'entityTypeId'),
  }) {
    if (
      isType(entityId, 'entityId', 'number') &&
      isType(entityTypeId, 'entityTypeId', 'number')
    ) {
      const {
        Auth,
        ContentItem,
        ContentChannel,
        DefinedValueList,
        Group,
        PrayerRequest,
      } = this.context.dataSources;
      switch (entityTypeId) {
        case ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM:
          // Delete the existing Content Item
          await this.delete({ key: this.KEY_TEMPLATES.contentItem`${entityId}` });

          /**
           * Request the full Content Item from ContentItem data source so that it gets cached
           * consistently.
           */
          const contentItem = await ContentItem.getFromId(entityId);

          if (
            get(
              ROCK_MAPPINGS,
              'CONTENT_ITEM.EventContentItem.ContentChannelTypeId',
              []
            ).includes(contentItem.contentChannelTypeId)
          ) {
            /**
             * For Event Content Items, we're less surgical with our caching,
             * so let's clear out the entire Events cache and refetch
             */
            await this.delete({ key: this.KEY_TEMPLATES.eventContentItems });
            await ContentItem.getEventContentIds();
          }

          /**
           * Look to see if this Content Item is in a Page Builder Content Channel
           * and update the `pathnameId` in Redis if so.
           */
          keys(PAGE_BUILDER).forEach((key) => {
            const configuration = PAGE_BUILDER[key];
            if (
              configuration.contentChannelId &&
              contentItem.contentChannelId === configuration.contentChannelId
            ) {
              const queryAttribute = get(configuration, 'queryAttribute', 'url');
              const page = get(contentItem, `attributeValues.${queryAttribute}.value`);
              if (page) {
                const pathname = `${key}/${page}`;
                this.set({
                  key: this.KEY_TEMPLATES.pathnameId`${pathname}`,
                  data: contentItem.id,
                  expiresIn: 60 * 60 * 12, // 12 hour cache
                });
              }
            }
          });

          /**
           * Look to see if this Content Item is cached as a part of a Content Channel
           * Items Id cache and update if so
           */
          const contentChannelIds = await this.get({
            key: this.KEY_TEMPLATES
              .contentChannelItemIds`${contentItem.contentChannelId}`,
          });

          if (contentChannelIds) {
            await this.delete({
              key: this.KEY_TEMPLATES
                .contentChannelItemIds`${contentItem.contentChannelId}`,
            });
            ContentChannel.getContentItemIds(contentItem.contentChannelId);
          }

          /**
           * Look to see if this Content Item has it's childre cached and flush
           * that if so
           */
          const childrenIds = await this.get({
            key: this.KEY_TEMPLATES.contentItemChildren`${contentItem.id}`,
          });

          if (childrenIds) {
            await this.delete({
              key: this.KEY_TEMPLATES.contentItemChildren`${contentItem.id}`,
            });
            ContentChannel.getContentItemIds(contentItem.contentChannelId);
          }

          return 'Success';
        case ROCK_ENTITY_IDS.PRAYER_REQUEST:
          if (entityId > 0) {
            // Delete the existing Prayer Request
            await this.delete({ key: this.KEY_TEMPLATES.prayerRequest`${entityId}` });

            /**
             * Request the full Content Item from ContentItem data source so that it gets cached
             * consistently.
             */
            await PrayerRequest.getFromId(entityId);
          }

          /**
           * If there is a user currently logged in, that means that they most
           * likely are flushing the cache after adding a new prayer request.
           *
           * In this case, let's go ahead and kill the cache for that user in order
           * to update it with their new request
           */
          try {
            const { id } = Auth.getCurrentUser;
            await this.delete({ key: this.KEY_TEMPLATES.personPrayers`${id}` });
            await PrayerRequest.getIdsByPerson(id);
          } catch (e) {
            console.log(
              'No user logged in when flushing a prayer request cache. Ignoring user cached data'
            );
          }
          return 'Success';
        case ROCK_ENTITY_IDS.DEFINED_TYPE:
          // Delete the existing Defined Type
          await this.delete({ key: this.KEY_TEMPLATES.definedType`${entityId}` });

          /**
           * Request the full Defined Type from DefinedValueList data source so that it gets cached immediately.
           */
          await DefinedValueList.getFromId(entityId);

          /**
           * If the Entity Id is one of our Exclude Lists for Groups, we'll flush Group Exclude Ids
           */
          if (entityId === EXCLUDE_GROUPS || entityId === EXCLUDE_VOLUNTEER_GROUPS) {
            await this.delete({ key: this.KEY_TEMPLATES.groupExcludeIds });
            Group._getExcludedGroupIds();
          }

          /**
           * If the Entity Id is our Group Roles List, we'll flush Group Roles
           */
          if (entityId === GROUP_MEMBER_ROLES) {
            await this.delete({ key: this.KEY_TEMPLATES.groupRoles });
            Group._getValidGroupRoles();
          }

          return 'Success';
        case ROCK_ENTITY_IDS.PERSON:
          /**
           * Delete the existing Person
           * Request the full Person from the Person data source so that it gets cached immediately.
           */
          await this.delete({ key: this.KEY_TEMPLATES.person`${entityId}` });
          await Person.getFromId(entityId);

          /**
           * Delete Groups for the Person
           * Request all Groups for that person so new data gets cached immediately
           */
          await this.delete({ key: this.KEY_TEMPLATES.personGroups`${entityId}` });
          await Group.getByPerson({
            personId: entityId,
          });

        default:
          return 'Failed';
      }
    }
  }

  flushFor(system, args) {
    switch (system) {
      case 'ROCK':
        return this.updateRockEntity(args);
      default:
        return;
    }
  }
}
