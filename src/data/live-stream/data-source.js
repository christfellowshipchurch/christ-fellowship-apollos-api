import { dataSource as definedValueDataSource } from '../defined-value';
import moment from 'moment-timezone';
import { compareAsc, parseISO } from 'date-fns';
import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import crypto from 'crypto-js';
import { get } from 'lodash';

const { ROCK_MAPPINGS, ROCK } = ApollosConfig;
const { DEFINED_TYPES } = ROCK_MAPPINGS;
const { LIVE_STREAM_SCHEDULES } = DEFINED_TYPES;

export default class LiveStream extends definedValueDataSource {
  get baseURL() {
    return ApollosConfig.CHURCH_ONLINE.URL;
  }

  get mediaUrls() {
    return ApollosConfig.CHURCH_ONLINE.MEDIA_URLS;
  }

  get webViewUrl() {
    return ApollosConfig.CHURCH_ONLINE.WEB_VIEW_URL;
  }

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

  async getNextInstance({ attributeValues }) {
    const { Schedule } = this.context.dataSources;
    const scheduleId = attributeValues?.schedule?.value;

    if (scheduleId) {
      const schedule = await Schedule.getFromId(scheduleId);
      if (schedule) {
        const parsedSchedule = await Schedule.parseiCalendar(schedule.iCalendarContent);

        const nextInstance = parsedSchedule
          .sort((a, b) => {
            const dateA = parseISO(a.start);
            const dateB = parseISO(b.start);

            return compareAsc(dateA, dateB);
          })
          .find(() => true);

        return nextInstance;
      }
    }

    return null;
  }

  async getStreamChatChannel(root) {
    const { Flag } = this.context.dataSources;
    const featureFlagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT');

    if (featureFlagStatus !== 'LIVE') {
      return null;
    }

    const { id } = root;
    const nextInstance = await this.getNextInstance(root);

    if (nextInstance) {
      const { start, end } = nextInstance;
      const derivedId = JSON.stringify({ id, eventStartTime: start, eventEndTime: end });
      const globalId = createGlobalId(derivedId, 'LiveStream');
      const channelId = crypto.SHA1(globalId).toString();

      return {
        id: root.id,
        channelId,
        channelType: 'livestream',
      };
    }

    return null;
  }

  async getLiveStreams(props) {
    const { Person } = this.context.dataSources;
    const anonymously = get(props, 'anonymously', false);

    let personas = [];
    const filterByPersona = ({ securityDataViews }) => {
      if (!!securityDataViews && securityDataViews.length > 0) {
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

    try {
      const { DefinedValueList } = this.context.dataSources;

      const definedType = await DefinedValueList.getFromId(LIVE_STREAM_SCHEDULES);
      const definedValues = get(definedType, 'definedValues', []);
      const liveStreams = await Promise.all(
        definedValues.map((definedValue) => {
          const request = async () => {
            let isLive = false;
            const nextInstance = await this.getNextInstance(definedValue);

            if (nextInstance) {
              const { start, end } = nextInstance;
              isLive = moment().isBetween(start, end);
            }

            return {
              ...definedValue,
              securityDataViews: definedValue?.attributeValues?.securityDataViews?.value,
              isLive,
            };
          };

          return request();
        })
      );

      return liveStreams
        .filter((liveStream) => !!liveStream)
        .filter(({ isLive }) => isLive)
        .filter((liveStream) => filterByPersona(liveStream));
    } catch (e) {
      console.log('Error fetching Live Streams');
      console.log({ e });
    }

    return [];
  }

  async byContentItem({ guid }) {
    const { Cache } = this.context.dataSources;
    const requestBase = 'DefinedValues/GetByAttributeValue';
    const key = 'ContentItem';
    const value = guid;

    const request = () =>
      this.request(
        `${requestBase}?attributeKey=${key}&value=${value}&loadAttributes=expanded`
      ).get();
    const definedValues = await Cache.request(request, {
      expiresIn: 60 * 10, // 10 minute Cache
      key: Cache.KEY_TEMPLATES.liveStreamRelatedNode`${guid}`,
    });

    const definedValuesFilteredByShedule = await Promise.all(
      definedValues.map((definedValue) => {
        const request = async () => {
          const nextInstance = await this.getNextInstance(definedValue);

          if (nextInstance) {
            const { start, end } = nextInstance;
            return moment().isBetween(start, end) ? definedValue : null;
          }

          return null;
        };

        return request();
      })
    );

    return definedValuesFilteredByShedule.find((definedValue) => !!definedValue);
  }
}
