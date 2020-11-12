import { dataSource as matrixItemDataSource } from '../matrix-item'
import moment, { tz } from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'
import { createGlobalId } from '@apollosproject/server-core'
import { split, filter, get, find, flatten, flattenDeep, uniqBy } from 'lodash'

import { getIdentifierType } from '../utils'
import WeekendServices from './weekend-services'

const { ROCK_MAPPINGS, ROCK } = ApollosConfig
const { TIMEZONE } = ROCK

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
    const { Cache } = this.context.dataSources;
    const cachedKey = `liveStream-relatedNode-${id}`
    const cachedValue = await Cache.get({
      key: cachedKey,
    });

    if (cachedValue) {
      return cachedValue;
    }

    const attributeMatrixItem = await this.request(`/AttributeMatrixItems`)
      .expand('AttributeMatrix')
      .filter(`Id eq ${id}`)
      .select(`AttributeMatrix/Guid`)
      .first()
    const { attributeMatrix } = attributeMatrixItem

    if (attributeMatrix) {
      const attributeValue = await this.request('/AttributeValues')
        .expand('Attribute')
        .filter(`Value eq '${attributeMatrix.guid}'`)
        .andFilter(`(Attribute/EntityTypeId eq 208)`) // append for specific EntityTypes that are supported
        .select('EntityId, Attribute/EntityTypeId')
        .first()

      if (attributeValue) {
        const { ContentItem } = this.context.dataSources
        const { entityId, attribute } = attributeValue
        const { entityTypeId } = attribute

        switch (entityTypeId) {
          case 208: // Entity Type Id for Content Item
            const contentItem = await ContentItem.getFromId(entityId)

            const resolvedType = ContentItem.resolveType(contentItem)
            const globalId = createGlobalId(entityId, resolvedType)

            const finalObject = { ...contentItem, globalId }

            if (contentItem != null) {
              await Cache.set({
                key: cachedKey,
                data: finalObject,
                expiresIn: 60 * 60 // 1 hour cache
              });
            }

            return finalObject
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
      await Cache.set({
        key: cachedKey,
        data: liveStreamContentItemsWithNextOccurrences,
        expiresIn: 60 * 10 // ten minute cache 
      });
    }

    return liveStreamContentItemsWithNextOccurrences;
  }

  async byAttributeMatrixTemplate(props) {
    const { Schedule, Person } = this.context.dataSources
    const TEMPLATE_ID = 11
    const anonymously = get(props, 'anonymously', false)

    // Get Attribute Matrix by Template Id
    const attributeMatrices = await this.request('/AttributeMatrices')
      .filter(`AttributeMatrixTemplateId eq ${TEMPLATE_ID}`)
      .select('Guid')
      .get()

    // Get Content Channel Items where Attribute Value is equal to Attribute Matrix Guid
    const contentChannelItemPromises = await Promise.all(attributeMatrices.map(({ guid }) => {
      const attributeKey = "LiveStreams"
      const query = `attributeKey=${attributeKey}&value=${guid}`

      return this.request(`/ContentChannelItems/GetByAttributeValue?${query}`)
        .get()
    }))

    const contentChannelItems = flattenDeep(contentChannelItemPromises.filter(i => i.length))

    let personas = []

    /**
     * Only fetch user personas if we do _not_ want to make this request
     * as an anonymous user
     */
    if (!anonymously) {
      try {
        personas = await Person.getPersonas({ categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId })
      } catch (e) {
        console.log("Events: Unable to retrieve personas for user.")
        console.log(e)
      }
    }

    const itemsBySecurityGroup = contentChannelItems.filter(item => {
      /**
       * Get security data views for the given content channel item from
       * an attribute value. Rock stores data views as a string of comma
       * separated Guids
       * 
       * Split the string by a comma so we can just work with an array of
       * strings
       */
      const securityDataViews = split(
        get(item, 'attributeValues.securityDataViews.value', ''),
        ','
      ).filter(dv => !!dv)

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

        if (anonymously) return false

        const userInSecurityDataViews = personas.filter(({ guid }) => securityDataViews.includes(guid))

        return userInSecurityDataViews.length > 0
      }

      /**
       * If there are no security data views on this content item, that means
       * that this item is globally accessible and we're good to return `true`
       */
      return true
    })

    // Get Attribute Matrix Items from the "filtered" Attribute Matrix Guids
    const attributeMatrixItemPromises = await Promise.all(
      itemsBySecurityGroup.map(({ id, attributeValues }) => {
        const attributeMatrixGuid = get(attributeValues, 'liveStreams.value')
        return this.request('/AttributeMatrixItems')
          .expand('AttributeMatrix')
          .filter(`AttributeMatrix/${getIdentifierType(attributeMatrixGuid).query}`)
          .transform((results) => results.map(n =>
            ({ ...n, contentChannelItemId: id }))
          )
          .get()
      })
    )
    const attributeMatrixItems = flattenDeep(attributeMatrixItemPromises)

    const upcomingOrLive = []

    await Promise.all(attributeMatrixItems.map(async matrixItem => {
      const scheduleGuid = get(matrixItem, "attributeValues.schedule.value")
      if (scheduleGuid) {
        // Do we need to filter this list by only getting Schedules that have an 
        // `EffectiveStartDate` in the past? Do we care about future schedules in
        // this context?
        const schedule = await this.request('/Schedules')
          .select('Id, iCalendarContent')
          .filter(`${getIdentifierType(scheduleGuid).query}`)
          .first()

        const scheduleInstances = await Schedule.parseiCalendar(schedule.iCalendarContent)

        upcomingOrLive.push(...scheduleInstances
          // .filter(instance => moment().isSameOrBefore(instance.end)) // returns all live or upcoming
          .filter(instance => moment().isBetween(moment(instance.start), moment(instance.end))) // returns only live
          .map(({ start, end }) => ({ ...matrixItem, eventStartTime: start, eventEndTime: end }))
        )
      }

      return
    }))

    /**
     * Weird bug where some schedules were being returned twice.
     * This filters to make sure we're only returning a Live Stream instance once
     */
    return uniqBy(upcomingOrLive, (elem) => [elem.id, elem.eventStartTime, elem.eventEndTime].join())
  }

  async getLiveStreams(props) {
    const dayOfWeek = moment.tz(TIMEZONE).format('dddd').toLowerCase()

    if (dayOfWeek === 'saturday' || dayOfWeek === 'sunday') {
      return this.weekendServiceIsLive(moment().utc().toISOString())
    }

    const anonymously = get(props, 'anonymously', false)

    const { Cache } = this.context.dataSources;
    const cachedKey = `${process.env.CONTENT}_liveStreams`
    const cachedValue = await Cache.get({
      key: cachedKey,
    });

    if (cachedValue) {
      return cachedValue;
    }

    /**
     * Rock is returning 404's on Attribute Matrices for some reason,
     * so we're going to just wrap this whole statement inside of a
     * { try catch } so that we don't end up freaking out the system
     * if Rock is unable to find a value.
     */
    try {
      const attributeMatrix = await this.byAttributeMatrixTemplate({ anonymously })

      if (attributeMatrix != null) {
        await Cache.set({
          key: cachedKey,
          data: attributeMatrix,
          expiresIn: 60 // 60 minute
        });
      }

      return attributeMatrix.filter(i => !!i)
    } catch (e) {
      console.log("Error fetching Live Streams by Attribute Matrix Template")
      console.log({ e })      
    }

    return null
  }

  weekendServiceIsLive(date) {
    const mDate = moment(date).tz(TIMEZONE)

    if (mDate.isValid()) {
      const weekendService = WeekendServices.find(service => {
        const { day, start, end } = service
        const isDay = mDate.format('dddd').toLowerCase() === day
        
        const startTime = parseInt(`${start.hour}${start.minute}`)
        const endTime = parseInt(`${end.hour}${end.minute}`)
        const hourInt = parseInt(mDate.format('Hmm'))
        
        const isBetween = hourInt >= startTime && hourInt <= endTime
        
        return isDay && isBetween
      })
  
      if (!!weekendService) {
        return [{
          isLive: true,
          eventStartTime: moment()
            .tz(TIMEZONE)
            .hour(weekendService.start.hour)
            .minute(weekendService.start.minute)
            .utc().toISOString(),
          eventEndTime: moment()
            .tz(TIMEZONE)
            .hour(weekendService.end.hour)
            .minute(weekendService.end.minute)
            .utc().toISOString(),
          title: "Christ Fellowship Everywhere",
          contentChannelItemId: 8377,
          attributeValues: {
            liveStreamUrl: {
              value: "https://link.theplatform.com/s/IfSiAC/media/h9hnjqraubSs/file.m3u8?metafile=false&formats=m3u&auto=true"
            }
          }
        }]
      }
    }

    return []
  }
}
