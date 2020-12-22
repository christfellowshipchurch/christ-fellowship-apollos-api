import { dataSource as matrixItemDataSource } from '../matrix-item';
import moment, { tz } from 'moment-timezone';
import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import { split, filter, get, find, flatten, flattenDeep, uniqBy, first } from 'lodash';

import { getIdentifierType } from '../utils';
import WeekendServices from './weekend-services';

const { ROCK_MAPPINGS, ROCK } = ApollosConfig;
const { TIMEZONE } = ROCK;

export default class LiveStream extends matrixItemDataSource {
  get baseURL() {
    return ApollosConfig.CHURCH_ONLINE.URL;
  }

  get mediaUrls() {
    return ApollosConfig.CHURCH_ONLINE.MEDIA_URLS;
  }

  get webViewUrl() {
    return ApollosConfig.CHURCH_ONLINE.WEB_VIEW_URL;
  }

  getFromId = (id) => {
    const decoded = JSON.parse(id);

    return this.request()
      .filter(`Id eq ${decoded.id}`)
      .transform((result) =>
        result.map((node, i) => ({
          ...node,
          eventStartTime: decoded.eventStartTime,
          eventEndTime: decoded.eventEndTime,
        }))
      )
      .first();
  };

  getRelatedNodeFromId = async (id) => {
    const request = async () => {
      const attributeMatrixItem = await this.request(`/AttributeMatrixItems`)
        .expand('AttributeMatrix')
        .filter(`Id eq ${id}`)
        .select(`AttributeMatrix/Guid`)
        .first();
      const { attributeMatrix } = attributeMatrixItem;

      if (attributeMatrix) {
        const attributeValue = await this.request('/AttributeValues')
          .expand('Attribute')
          .filter(`Value eq '${attributeMatrix.guid}'`)
          .andFilter(`(Attribute/EntityTypeId eq 208)`) // append for specific EntityTypes that are supported
          .select('EntityId, Attribute/EntityTypeId')
          .first();

        if (attributeValue) {
          const { ContentItem } = this.context.dataSources;
          const { entityId, attribute } = attributeValue;
          const { entityTypeId } = attribute;

          switch (entityTypeId) {
            case 208: // Entity Type Id for Content Item
              const contentItem = await ContentItem.getFromId(entityId);

              const resolvedType = ContentItem.resolveType(contentItem);
              const globalId = createGlobalId(entityId, resolvedType);

              const finalObject = { ...contentItem, globalId };

              return finalObject;
            default:
              return null;
          }
        }
      }

      return null;
    };

    const { Cache } = this.context.dataSources;
    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.liveStreamRelatedNode`${id}`,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });
  };

  async getLiveStream() {
    const stream = await this.get('events/current');
    return {
      isLive: get(stream, 'response.item.isLive', false),
      eventStartTime: get(stream, 'response.item.eventStartTime'),
      media: () =>
        this.mediaUrls.length
          ? {
              sources: this.mediaUrls.map((uri) => ({
                uri,
              })),
            }
          : null,
      webViewUrl: this.webViewUrl,
    };
  }

  async getStreamChatChannel(root) {
    const { Auth, StreamChat, Flag } = this.context.dataSources;
    const featureFlagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT');

    if (featureFlagStatus !== 'LIVE') {
      return null;
    }

    const resolvedType = this.resolveType(root);
    const globalId = createGlobalId(root.id, resolvedType);
    const channelId = crypto.SHA1(globalId).toString();
    return {
      id: root.id,
      channelId,
      channelType: CHANNEL_TYPE,
    };
  }

  async getLiveStreamContentItems() {
    const request = async () => {
      // Get Events
      const { ContentItem, Schedule } = this.context.dataSources;
      const eventContentItems = await ContentItem.getEvents();

      // Filter events that don't have a Live Stream url
      const liveStreamContentItems = filter(eventContentItems, (event) => {
        const uri = get(event, 'attributeValues.liveStreamUri.value', '');

        return uri && uri !== '' && uri.startsWith('http');
      });

      // Add the nextOccurrence to the Rock Object to make
      // it easier to access this data in the return object
      const liveStreamContentItemsWithNextOccurrences = await Promise.all(
        liveStreamContentItems.map(async (contentItem) => {
          const schedules = split(
            get(contentItem, 'attributeValues.schedules.value', ''),
            ','
          );
          const nextOccurrences = await Schedule.getOccurrencesFromIds(schedules);

          return {
            ...contentItem,
            nextOccurrences: nextOccurrences.filter((o) => !!o),
          };
        })
      );

      return liveStreamContentItemsWithNextOccurrences;
    };

    const { Cache } = this.context.dataSources;

    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.liveStreamContentItems,
      expiresIn: 60 * 10, // 10 minute cache
    });
  }

  async byAttributeMatrixGuid(attributeMatrixGuid, { contentChannelItemId }) {
    const { Schedule } = this.context.dataSources;

    if (attributeMatrixGuid) {
      const attributeItems = await this.request('/AttributeMatrixItems')
        .expand('AttributeMatrix')
        .filter(`AttributeMatrix/${getIdentifierType(attributeMatrixGuid).query}`)
        .get();

      const liveStreamData = await Promise.all(
        attributeItems.map(async (item) => {
          const url = get(item, 'attributeValues.liveStreamUrl.value');
          const scheduleGuid = get(item, 'attributeValues.schedule.value');

          if (scheduleGuid && scheduleGuid !== '' && url && url !== '') {
            const schedule = await Schedule.getFromId(scheduleGuid);
            if (schedule) {
              const nextInstance = await Schedule._parseCustomSchedule(
                schedule.iCalendarContent
              );

              return {
                id: item.id,
                contentChannelItemId,
                eventStartTime: nextInstance.nextStart,
                eventEndTime: nextInstance.nextEnd,
                attributeValues: {
                  liveStreamUrl: {
                    value: url,
                  },
                },
              };
            }
          }

          return null;
        })
      );

      return first(liveStreamData.filter((ls) => !!ls).sort((a, b) => moment(a).diff(b)));
    }
  }

  async byAttributeMatrixTemplate() {
    const { Schedule, ContentItem, Cache } = this.context.dataSources;
    const TEMPLATE_ID = 11;

    // Get Attribute Matrix by Template Id
    const attributeMatrices = await this.request('/AttributeMatrices')
      .filter(`AttributeMatrixTemplateId eq ${TEMPLATE_ID}`)
      .select('Guid')
      .get();

    // Get Content Channel Items where Attribute Value is equal to Attribute Matrix Guid
    const contentChannelItemPromises = await Promise.all(
      attributeMatrices.map(async ({ guid }) => {
        const attributeKey = 'LiveStreams';
        const cachedKey = `${process.env.CONTENT}__${attributeKey}_${guid}`;
        const getContentItems = () =>
          ContentItem.byAttributeValue(attributeKey, guid).get();

        return Cache.request(getContentItems, {
          key: cachedKey,
          expiresIn: 60 * 15, // 15 minute cache
        });
      })
    );

    const contentChannelItems = flattenDeep(
      contentChannelItemPromises.filter((i) => i.length)
    );

    // Get Attribute Matrix Items from the "filtered" Attribute Matrix Guids
    const attributeMatrixItemPromises = await Promise.all(
      contentChannelItems.map(({ id, attributeValues }) => {
        const attributeMatrixGuid = get(attributeValues, 'liveStreams.value');
        /**
         * Get security data views for the given content channel item from
         * an attribute value. Rock stores data views as a string of comma
         * separated Guids
         *
         * Split the string by a comma so we can just work with an array of
         * strings
         */
        const securityDataViews = split(
          get(attributeValues, 'securityDataViews.value', ''),
          ','
        ).filter((dv) => !!dv);

        return this.request('/AttributeMatrixItems')
          .expand('AttributeMatrix')
          .filter(`AttributeMatrix/${getIdentifierType(attributeMatrixGuid).query}`)
          .transform((results) =>
            results.map((n) => ({ ...n, contentChannelItemId: id, securityDataViews }))
          )
          .get();
      })
    );
    const attributeMatrixItems = flattenDeep(attributeMatrixItemPromises);

    const upcomingOrLive = [];

    await Promise.all(
      attributeMatrixItems.map(async (matrixItem) => {
        const scheduleGuid = get(matrixItem, 'attributeValues.schedule.value');
        if (scheduleGuid) {
          // Do we need to filter this list by only getting Schedules that have an
          // `EffectiveStartDate` in the past? Do we care about future schedules in
          // this context?
          const schedule = await this.request('/Schedules')
            .select('Id, iCalendarContent')
            .filter(`${getIdentifierType(scheduleGuid).query}`)
            .first();

          const scheduleInstances = await Schedule.parseiCalendar(
            schedule.iCalendarContent
          );

          upcomingOrLive.push(
            ...scheduleInstances
              // .filter(instance => moment().isSameOrBefore(instance.end)) // returns all live or upcoming
              .filter((instance) =>
                moment().isBetween(moment(instance.start), moment(instance.end))
              ) // returns only live
              .map(({ start, end }) => ({
                ...matrixItem,
                eventStartTime: start,
                eventEndTime: end,
              }))
          );
        }

        return;
      })
    );

    /**
     * Weird bug where some schedules were being returned twice.
     * This filters to make sure we're only returning a Live Stream instance once
     */
    return uniqBy(upcomingOrLive, (elem) =>
      [elem.id, elem.eventStartTime, elem.eventEndTime].join()
    );
  }

  async getLiveStreams(props) {
    const { Person } = this.context.dataSources;
    const dayOfWeek = moment.tz(TIMEZONE).format('dddd').toLowerCase();

    if (dayOfWeek === 'saturday' || dayOfWeek === 'sunday' || dayOfWeek === 'wednesday') {
      return this.weekendServiceIsLive(moment().utc().toISOString());
    }

    const anonymously = get(props, 'anonymously', false);

    let personas = [];
    const filterByPersona = ({ securityDataViews, ...props }) => {
      if (securityDataViews.length > 0) {
        /**
         * If there is at least 1 guid, we are going to check to see if the current user
         * is in at least one of those security groups. If so, we're good to return `true`.
         *
         * If there are no common guids, we return false to filter this option out of the
         * collection of items for the user's live streams
         *
         * If there is at least 1 Guid and we want to make this request anonymously, just
         * immediately return `false`
         */

        if (anonymously) return false;

        const userInSecurityDataViews = personas.filter(({ guid }) =>
          securityDataViews.includes(guid)
        );

        return userInSecurityDataViews.length > 0;
      }

      /**
       * If there are no security data views on this content item, that means
       * that this item is globally accessible and we're good to return `true`
       */
      return true;
    };

    /**
     * Only fetch user personas if we do _not_ want to make this request
     * as an anonymous user
     */
    if (!anonymously) {
      try {
        personas = await Person.getPersonas({
          categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId,
        });
      } catch (e) {
        console.log('Live Streams: Unable to retrieve personas for user.');
        console.log(e);
      }
    }

    /**
     * Rock is returning 404's on Attribute Matrices for some reason,
     * so we're going to just wrap this whole statement inside of a
     * { try catch } so that we don't end up freaking out the system
     * if Rock is unable to find a value.
     */
    const liveStreamRequest = () => {
      try {
        return this.byAttributeMatrixTemplate();
      } catch (e) {
        console.log('Error fetching Live Streams by Attribute Matrix Template');
        console.log({ e });
      }

      return [];
    };

    const { Cache } = this.context.dataSources;
    const liveStreams = await Cache.request(liveStreamRequest, {
      key: Cache.KEY_TEMPLATES.liveStreams,
      expiresIn: 60 * 10, // 10 minute cache
    });

    return typeof Array.isArray(liveStreams) ? liveStreams.filter(filterByPersona) : [];
  }

  weekendServiceIsLive(date) {
    const mDate = moment(date).tz(TIMEZONE);

    if (mDate.isValid()) {
      const weekendService = WeekendServices.find((service) => {
        const { day, start, end } = service;
        const isDay = mDate.format('dddd').toLowerCase() === day;

        const startTime = parseInt(`${start.hour}${start.minute}`);
        const endTime = parseInt(`${end.hour}${end.minute}`);
        const hourInt = parseInt(mDate.format('Hmm'));

        const isBetween = hourInt >= startTime && hourInt <= endTime;

        return isDay && isBetween;
      });

      if (!!weekendService) {
        return [
          {
            isLive: true,
            eventStartTime: moment()
              .tz(TIMEZONE)
              .hour(weekendService.start.hour)
              .minute(weekendService.start.minute)
              .utc()
              .toISOString(),
            eventEndTime: moment()
              .tz(TIMEZONE)
              .hour(weekendService.end.hour)
              .minute(weekendService.end.minute)
              .utc()
              .toISOString(),
            title: 'Christ Fellowship Everywhere',
            contentChannelItemId: 8377,
            attributeValues: {
              liveStreamUrl: {
                value:
                  'https://link.theplatform.com/s/IfSiAC/media/h9hnjqraubSs/file.m3u8?metafile=false&formats=m3u&auto=true',
              },
            },
          },
        ];
      }
    }

    return [];
  }
}
