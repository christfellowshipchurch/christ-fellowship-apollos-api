import * as RedisCache from '@apollosproject/data-connector-redis-cache';
import { isRequired } from '../utils';

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

  /**
   * For a given request
   * @param {function}  request         Async method whose return value gets cached.
   * @param {object}    args
   * @param {string}    args.key        Key for the value when stored in Redis.
   * @param {number}    args.expiresIn  The length of time that the cache should be set for.
   */
  async request(
    requestMethod = isRequired('Cache.request', 'requestMethod'),
    { key = isRequired('Cache.request', 'args.key'), expiresIn = this.DEFAULT_TIMEOUT }
  ) {
    if (typeof requestMethod === 'function') {
      if (typeof key === 'string') {
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
      } else {
        throw new TypeError(
          `'key' value of ${key} should be a string, not a ${typeof key}`,
          'redis-cache/data-source.js'
        );
      }
    } else {
      throw new TypeError(
        `'key' value of ${requestMethod} should be a string, not a ${typeof requestMethod}`,
        'redis-cache/data-source.js'
      );
    }
  }
}
