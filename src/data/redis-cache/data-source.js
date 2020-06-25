import * as RedisCache from '@apollosproject/data-connector-redis-cache';

export default class Cache extends RedisCache.dataSource {
  // 24 hours in seconds
  DEFAULT_TIMEOUT = 86400
}