import { split, filter, get, find } from 'lodash'
import { dataSource as scheduleDataSource } from '../schedule'
import moment from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'


export default class LiveStream extends scheduleDataSource {
  resource = 'LiveStream';

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

  async getLiveStreams() {
    const liveStreamContentItems = await this.getLiveStreamContentItems()

    // Check the schedule on each event to see
    // if it's currently live
    const currentlyLiveContentItems = filter(liveStreamContentItems,
      ({ nextOccurrences }) =>
        find(nextOccurrences, occurrence => moment().isBetween(occurrence.startWithOffset, occurrence.end))
    )

    // Create the Live Stream object from the Content Items
    // that are currently live and return active Live Streams
    return currentlyLiveContentItems.map(async contentItem => {

      // These are our LiveStream Calls to Action
      // Here we use the matrix items in Rock in case we want to add 
      // other attirbutes like images to these items down the road. 

      // First we grab the guid and matrix items
      const callsToActionGuid = get(contentItem, 'attributeValues.liveStreamCallstoAction.value', null)
      const callsToActionMatrixItems = await this.context.dataSources.MatrixItem.getItemsFromId(callsToActionGuid)
      
      // then we map the values into the correctly shaped objects
      const callsToAction = callsToActionMatrixItems.map(item => {
        const { call, action } = item.attributeValues
        return {
          call: call.value,
          action: action.value
        }
      })

      return ({
        isLive: true,
        eventStartTime: null, // TODO
        media: {
          sources: [{ uri: get(contentItem, 'attributeValues.liveStreamUri.value', '') }]
        },
        webViewUrl: get(contentItem, 'attributeValues.liveStreamUri.value', ''),
        contentItem,
        callsToAction
      })
    })
  }
}
