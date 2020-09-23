import { dataSource as matrixItemDataSource } from '../matrix-item'
import moment from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'
import { split, filter, get, find, flatten } from 'lodash'

import { getIdentifierType } from '../utils'

const { ROCK } = ApollosConfig

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
    const decoded = JSON.parse(id)

    return this.request()
      .filter(`Id eq ${decoded.id}`)
      .transform((result) =>
        result.map((node, i) => ({
          ...node,
          eventStartTime: decoded.eventStartTime,
          eventEndTime: decoded.eventEndTime,
        }))
      )
      .first()
  };

  getRelatedNodeFromId = async (id) => {
    const attributeMatrix = await this.request(`/AttributeMatrixItems`)
      .expand('AttributeMatrix')
      .filter(`Id eq ${id}`)
      .select(`AttributeMatrix/Guid`)
      .first()

    console.log({ attributeMatrix })

    if (attributeMatrix) {
      const attributeValue = await this.request('/AttributeValues')
        .expand('Attribute')
        .filter(`Value eq '${attributeMatrix.guid}'`)
        .andFilter(`(EntityTypeId eq 208)`) // append for specific EntityTypes that are supported
        .select('EntityId, Attribute/EntityTypeId')
        .first()

      console.log({ attributeValue })

      if (attributeValue) {
        const { ContentItem } = this.context.dataSources
        const { entityId, attribute } = attributeValue
        const { entityTypeId } = attribute

        console.log({ attributeValue, entityId, attribute, entityTypeId })

        switch (entityTypeId) {
          case 208: // Entity Type Id for Content Item
            return ContentItem.getFromId(entityId)
          default:
            return null
        }
      }
    }
    return null
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

  async getLiveStreamContentItems() {
    const { Cache } = this.context.dataSources;
    const cachedKey = `${process.env.CONTENT}_liveStreamContentItems`
    const cachedValue = await Cache.get({
      key: cachedKey,
    });

    if (cachedValue) {
      return cachedValue;
    }

    // Get Events
    const { ContentItem, Schedule } = this.context.dataSources;
    const eventContentItems = await ContentItem.getEvents()

    // Filter events that don't have a Live Stream url
    const liveStreamContentItems = filter(eventContentItems,
      event => {
        const uri = get(event, 'attributeValues.liveStreamUri.value', '')

        return uri && uri !== '' && uri.startsWith('http')
      }
    )

    // Add the nextOccurrence to the Rock Object to make
    // it easier to access this data in the return object
    const liveStreamContentItemsWithNextOccurrences = await Promise.all(liveStreamContentItems.map(async contentItem => {
      const schedules = split(get(contentItem, 'attributeValues.schedules.value', ''), ',')
      const nextOccurrences = await Schedule.getOccurrencesFromIds(schedules)

      return {
        ...contentItem,
        nextOccurrences: nextOccurrences.filter(o => !!o)
      }
    }))

    if (liveStreamContentItemsWithNextOccurrences != null) {
      Cache.set({
        key: cachedKey,
        data: liveStreamContentItemsWithNextOccurrences,
        expiresIn: 60 // one minute cache 
      });
    }

    return liveStreamContentItemsWithNextOccurrences;
  }

  async byAttributeMatrixTemplate() {
    const { Event, Schedule } = this.context.dataSources
    const TEMPLATE_ID = 11

    const attributeMatrix = await this.request('/AttributeMatrixItems')
      .expand('AttributeMatrix')
      .filter(`AttributeMatrix/AttributeMatrixTemplateId eq ${TEMPLATE_ID}`)
      .get()

    const upcomingOrLive = []

    await Promise.all(attributeMatrix.map(async matrixItem => {
      const scheduleGuid = get(matrixItem, "attributeValues.schedule.value")

      if (scheduleGuid) {
        // Do we need to filter this list by only getting Schedules that have an 
        // `EffectiveStartDate` in the past? Do we care about future schedules in
        // this context?
        const schedule = await this.request('/Schedules')
          .select('Id, iCalendarContent')
          .filter(`${getIdentifierType(scheduleGuid).query}`)
          .first()

        /** The iCalendar invite includes the "relative" start and end date of
         *  a given Schedule. This takes into account if a schedules has, for
         *  example, only 1 instance as opposed to many. Let's just filter those out
         *  right away before we take the time to break down the iCalendar into all
         *  instances
         */
        const { end } = Event.getDateTime(schedule)

        if (moment().isAfter(end)) return

        const scheduleInstances = await Schedule.parseiCalendar(schedule.iCalendarContent)

        console.log({
          scheduleInstances,
          filtered: scheduleInstances
            .filter(instance => moment().isSameOrBefore(instance.end))
        })

        upcomingOrLive.push(...scheduleInstances
          .filter(instance => moment().isSameOrBefore(instance.end))
          .map(({ start, end }) => ({ ...matrixItem, eventStartTime: start, eventEndTime: end }))
        )
      }

      return
    }))

    return upcomingOrLive
  }

  async getLiveStreams() {
    const byContentItems = async () => {
      const liveStreamContentItems = await this.getLiveStreamContentItems()

      // Check the schedule on each event to see
      // if it's currently live
      const currentlyLiveContentItems = filter(liveStreamContentItems,
        ({ nextOccurrences }) =>
          find(nextOccurrences, occurrence => moment().isBetween(occurrence.startWithOffset, occurrence.end))
      )

      // Create the Live Stream object from the Content Items
      // that are currently live and return active Live Streams
      return currentlyLiveContentItems.map(contentItem => {
        const { start, end } = find(contentItem.nextOccurrences, occurrence => moment().isBetween(occurrence.startWithOffset, occurrence.end))

        return ({
          eventStartTime: start,
          eventEndTime: end,
          media: {
            sources: [{ uri: get(contentItem, 'attributeValues.liveStreamUri.value', '') }]
          },
          webViewUrl: get(contentItem, 'attributeValues.liveStreamUri.value', ''),
          contentItem
        })
      })
    }

    const allQueries = await Promise.all([byContentItems(), this.byAttributeMatrixTemplate()])

    return flatten(allQueries).filter(i => !!i)
  }
}
