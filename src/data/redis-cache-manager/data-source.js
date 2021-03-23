import ApollosConfig from '@apollosproject/config';
import * as RedisCache from '../redis-cache';
import { keys, get } from 'lodash';
import { isRequired, isType, getIdentifierType } from '../utils';

const { ROCK_ENTITY_IDS, ROCK_FIELD_TYPE_IDS } = ApollosConfig;
const {
  CONTENT_CHANNEL,
  CONTENT_CHANNEL_ITEM,
  DEFINED_TYPE,
  DEFINED_VALUE,
  GROUP,
  PRAYER_REQUEST,
  PERSON,
  SCHEDULE,
} = ROCK_ENTITY_IDS;

const cacheLog = (type, entityId) => console.log(`[redis cache] ${type} : ${entityId}`);

export default class CacheManager extends RedisCache.dataSource {
  async _getEntityAttributeValues({
    entityId = isRequired('Cache.updateRockEntity', 'entityId'),
    entityTypeId = isRequired('Cache.updateRockEntity', 'entityTypeId'),
  }) {
    if (
      isType(entityId, 'entityId', 'number') &&
      isType(entityTypeId, 'entityTypeId', 'number')
    ) {
      const {
        ContentItem,
        ContentChannel,
        DefinedValueList,
        DefinedValue,
        Group,
        Person,
        PrayerRequest,
      } = this.context.dataSources;
      let entity = null;

      switch (entityTypeId) {
        case CONTENT_CHANNEL:
          entity = await ContentChannel.getFromId(entityId);
          break;
        case CONTENT_CHANNEL_ITEM:
          entity = await ContentItem.getFromId(entityId);
          break;
        case DEFINED_TYPE:
          entity = await DefinedValueList.getFromId(entityId);
          break;
        case DEFINED_VALUE:
          entity = await DefinedValue.getFromId(entityId);
          break;
        case GROUP:
          entity = await Group.getFromId(entityId);
          break;
        case PERSON:
          entity = await Person.getFromId(entityId);
          break;
        case PRAYER_REQUEST:
          entity = await PrayerRequest.getFromId(entityId);
          break;
        default:
          break;
      }

      if (entity) {
        /**
         * tl;dr : filter attribute values for guids
         *
         * Rock stores related entities in attribute values using a reference to the GUID of the related entity
         *
         * For this reason, the only attributes we want to flush are those who's value matches the pattern of a GUID.
         */
        const attributeValues = get(entity, 'attributeValues', {});
        const filteredAttributeValueKeys = keys(attributeValues).filter((key) => {
          const attributePath = `attributeValues.${key}.value`;
          const { type } = getIdentifierType(get(entity, attributePath, ''));
          return type === 'guid';
        });
        let relatedEntityIds = [];

        for (var i = 0; i < filteredAttributeValueKeys.length; i++) {
          const key = filteredAttributeValueKeys[i];
          const relatedEntityTypeIdPath = `attributes.${key}.fieldTypeId`;
          const relatedEntityGuid = get(entity, `attributeValues.${key}.value`);
          let redisKeyTemplate = null;
          let relatedEntityTypeId = null;

          switch (get(entity, relatedEntityTypeIdPath)) {
            case ROCK_FIELD_TYPE_IDS.CONTENT_CHANNEL_ITEM:
              redisKeyTemplate = this.KEY_TEMPLATES.contentItemGuidId;
              relatedEntityTypeId = CONTENT_CHANNEL_ITEM;
              break;
            case ROCK_FIELD_TYPE_IDS.DEFINED_VALUE:
              redisKeyTemplate = this.KEY_TEMPLATES.definedValueGuidId;
              relatedEntityTypeId = DEFINED_VALUE;
              break;
            case ROCK_FIELD_TYPE_IDS.SCHEDULE:
            case ROCK_FIELD_TYPE_IDS.SCHEDULE_BUILDER:
              redisKeyTemplate = this.KEY_TEMPLATES.scheduleGuidId;
              relatedEntityTypeId = SCHEDULE;
              break;
            default:
              break;
          }

          if (redisKeyTemplate) {
            const _key = `${this.keyPrefix}${redisKeyTemplate`${relatedEntityGuid}`}`;
            const id = await this.get({
              key: _key,
            });

            if (id) {
              relatedEntityIds.push({
                entityId: id,
                entityTypeId: relatedEntityTypeId,
              });
            }
          }
        }

        return relatedEntityIds;
      }
    }

    return [];
  }

  async recursivelyClear({
    entityId = isRequired('Cache.updateRockEntity', 'entityId'),
    entityTypeId = isRequired('Cache.updateRockEntity', 'entityTypeId'),
  }) {
    if (
      isType(entityId, 'entityId', 'number') &&
      isType(entityTypeId, 'entityTypeId', 'number')
    ) {
      /**
       * In order to help eleviate some unecessary strain, we will limit the recursive nature of this method to just Content Channel Items, Defined Values and Groups for the time being.
       */
      let recursiveEntities = [];
      switch (entityTypeId) {
        case CONTENT_CHANNEL:
          cacheLog('Content Channel', entityId);

          await this.delete({
            key: this.KEY_TEMPLATES.contentChannelItemIds`${entityId}`,
          });
          break;
        case CONTENT_CHANNEL_ITEM:
          cacheLog('Content Channel Item', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.contentItem`${entityId}` });
          await this.delete({ key: this.KEY_TEMPLATES.contentItemChildren`${entityId}` });
          await this.delete({ key: `contentItem:coverImage:${entity}` });

          recursiveEntities = await this._getEntityAttributeValues({
            entityId,
            entityTypeId,
          });
          break;
        case DEFINED_TYPE:
          cacheLog('Defined Type', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.definedType`${entityId}` });
          break;
        case DEFINED_VALUE:
          cacheLog('Defined Value', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.definedValue`${entityId}` });

          recursiveEntities = await this._getEntityAttributeValues({
            entityId,
            entityTypeId,
          });
          break;
        case GROUP:
          cacheLog('Group', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.group`${entityId}` });
          await this.delete({ key: this.KEY_TEMPLATES.groupLocations`${entityId}` });

          recursiveEntities = await this._getEntityAttributeValues({
            entityId,
            entityTypeId,
          });
          break;
        case PRAYER_REQUEST:
          cacheLog('Prayer Request', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.prayerRequest`${entityId}` });
          break;
        case PERSON:
          cacheLog('Person', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.person`${entityId}` });
          await this.delete({ key: this.KEY_TEMPLATES.personGroups`${entityId}` });
          await this.delete({ key: this.KEY_TEMPLATES.personPrayers`${entityId}` });
          break;
        case SCHEDULE:
          cacheLog('Schedule', entityId);

          await this.delete({ key: this.KEY_TEMPLATES.schedule`${entityId}` });

          recursiveEntities = await this._getEntityAttributeValues({
            entityId,
            entityTypeId,
          });
          break;
      }

      await Promise.all(recursiveEntities.map((entity) => this.recursivelyClear(entity)));
    }
  }
}
