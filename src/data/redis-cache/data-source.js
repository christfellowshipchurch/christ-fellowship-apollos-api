import * as RedisCache from '@apollosproject/data-connector-redis-cache';

export default class Cache extends RedisCache.dataSource {
  DEFAULT_TIMEOUT = 60 * 60
}