import ApollosConfig from '@apollosproject/config';
import * as RedisCache from '@apollosproject/data-connector-redis-cache';
import { keys, get } from 'lodash';
import { isRequired, isType } from '../utils';

const { ROCK_ENTITY_IDS, PAGE_BUILDER, ROCK_MAPPINGS } = ApollosConfig;

const parseKey = (key) => {
  if (Array.isArray(key)) {
    return key.join(':');
  }
  return key;
};

export default class Cache extends RedisCache.dataSource {
  DEFAULT_TIMEOUT = 60 * 60; // 1 hour cache

  KEY_TEMPLATES = {
    contentItem: (_, id) => `${process.env.CONTENT}_contentItem_${id}`,
    eventContentItems: `${process.env.CONTENT}_eventContentItems`,
    group: (_, id) => `${process.env.CONTENT}_group_${id}`,
    liveStreamRelatedNode: (_, id) => `liveStream-relatedNode-${id}`,
    liveStreamContentItems: `${process.env.CONTENT}_liveStreamContentItems`,
    liveStreams: `${process.env.CONTENT}_liveStreams`,
    attributeMatrix: (_, id) => `attribute_matrix_${id}`,
    pathnameId: (_, pathname) => `${process.env.CONTENT}_${pathname}`,
  };

  initialize({ context }) {
    this.context = context;
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
      const cachedValue = await this.get({
        key,
      });

      if (cachedValue) {
        return cachedValue;
      }

      const data = await requestMethod();

      if (data) {
        await this.set({
          key,
          data,
          expiresIn,
        });
      }

      return data;
    }
  }

  async delete({ key }, callback) {
    return this.safely(() => this.redis.del(parseKey(key), callback));
  }

  async updateRockEntity({
    entityId = isRequired('Cache.updateRockEntity', 'entityId'),
    entityTypeId = isRequired('Cache.updateRockEntity', 'entityTypeId'),
  }) {
    if (
      isType(entityId, 'entityId', 'number') &&
      isType(entityTypeId, 'entityTypeId', 'number')
    ) {
      switch (entityTypeId) {
        case ROCK_ENTITY_IDS.CONTENT_CHANNEL_ITEM:
          const { ContentItem } = this.context.dataSources;

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

            await this.delete(this.KEY_TEMPLATES.eventContentItems);
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

          return 'Success';
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
