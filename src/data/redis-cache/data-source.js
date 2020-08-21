import * as RedisCache from '@apollosproject/data-connector-redis-cache';

export default class Cache extends RedisCache.dataSource {
  // 1 hour cache
  DEFAULT_TIMEOUT = 60 * 60
}