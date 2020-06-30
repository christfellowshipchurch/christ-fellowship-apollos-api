import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import { createGlobalId } from '@apollosproject/server-core'
import {
  get,
  find,
  kebabCase,
  toLower,
  upperCase,
  split
} from 'lodash'

import { createVideoUrlFromGuid } from '../utils'

const { ROCK_MAPPINGS, ROCK, FEATURE_FLAGS } = ApollosConfig

export default class ContentItem extends coreContentItem.dataSource {
  expanded = true

  CORE_LIVE_CONTENT = this.LIVE_CONTENT

  LIVE_CONTENT = () => {
    // If we're in a staging environment, we want to
    //  return null so that no filter is applied over
    //  the content querying.
    // If we're not in a staging environment, we want
    //  to apply the standard LIVE_CONTENT filter based
    //  on the config.yml settings

    if (process.env.CONTENT === 'stage') {
      return null
    }

    return this.CORE_LIVE_CONTENT()
  }

  resolveType(props) {
    const {
      attributeValues,
      attributes,
    } = props

    return super.resolveType(props)
  }

  attributeIsRedirect = ({ key, attributeValues, attributes }) =>
    key.toLowerCase().includes('redirect') &&
    typeof attributeValues[key].value === 'string' &&
    attributeValues[key].value.startsWith('http') && // looks like a url
    attributeValues[key].value !== ""; // is not empty

  hasRedirect = ({ attributeValues, attributes }) =>
    Object.keys(attributes).filter((key) =>
      this.attributeIsRedirect({
        key,
        attributeValues,
        attributes,
      })
    ).length;

  attributeIsCallToAction = ({ key, attributeValues, attributes }) =>
    (key.toLowerCase().includes('call') &&
      key.toLowerCase().includes('action')) &&
    typeof attributeValues[key].value === 'string' &&
    attributeValues[key].value !== ""; // is not empty

  hasCallToAction = ({ attributeValues, attributes }) =>
    Object.keys(attributes).filter((key) =>
      this.attributeIsRedirect({
        key,
        attributeValues,
        attributes,
      })
    ).length;

  formatTitleAsUrl = (title) => kebabCase(toLower(title))

  getVideos = ({ attributeValues, attributes }) => {
    const videoKeys = Object.keys(attributes).filter((key) =>
      this.attributeIsVideo({
        key,
        attributeValues,
        attributes,
      })
    );
    return videoKeys.map((key) => ({
      __typename: 'VideoMedia',
      key,
      name: attributes[key].name,
      embedHtml: get(attributeValues, 'videoEmbed.value', null), // TODO: this assumes that the key `VideoEmebed` is always used on Rock
      sources: attributeValues[key].value
        ? [{ uri: createVideoUrlFromGuid(attributeValues[key].value) }]
        : [],
    })).filter(video => video.sources.length > 0 && !video.sources.find(source => source.uri === ''));
  }

  // title pattern should follow: the-article-title
  getByTitle = async (title, mapping) => {
    const contentChannels = get(ROCK_MAPPINGS, mapping, [])

    if (title === '' || contentChannels.length === 0) return null

    console.log({ title })

    const contentItems = await this.request(`ContentChannelItems`)
      .filterOneOf(contentChannels.map(n => `ContentChannelId eq ${n}`))
      .andFilter(`toupper(Title) eq '${upperCase(title)}'`)
      .get()

    return find(contentItems, (n) =>
      this.formatTitleAsUrl(get(n, 'title', '')) === this.formatTitleAsUrl(title)
    )
  }

  getContentByTitle = (title) => this.getByTitle(title, 'BROWSE_CONTENT_CHANNEL_IDS')
  getCategoryByTitle = (title) => this.getByTitle(title, 'CATEGORY_CONTENT_CHANNEL_IDS')

  getFromTypeIds = (ids) =>
    this.request()
      .filterOneOf(ids.map(n => `ContentChannelTypeId eq ${n}`))
      .get()

  getEvents = async (limit) => {
    const { Person } = this.context.dataSources
    const contentChannelTypes = get(ROCK_MAPPINGS, 'CONTENT_ITEM.EventContentItem.ContentChannelTypeId', [])

    if (contentChannelTypes.length === 0) {
      console.warn(
        'No Content Channel Types were found for events'
      )
      return null
    }

    const usePersonas = FEATURE_FLAGS.ROCK_DYNAMIC_FEED_WITH_PERSONAS.status === "LIVE"
    let personas = []
    if (usePersonas) {
      try {
        personas = await Person.getPersonas({ categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId })
      } catch (e) {
        console.log("Events: Unable to retrieve personas for user.")
        console.log(e)
      }
    }

    const { Cache } = this.context.dataSources;
    const cachedKey = `${process.env.CONTENT}_eventContentItems`
    let eventItems = await Cache.get({
      key: cachedKey,
    });

    if (!eventItems) {
      eventItems = await this.request(`ContentChannelItems`)
        .filterOneOf(contentChannelTypes.map(n => `ContentChannelTypeId eq ${n}`))
        .andFilter(this.LIVE_CONTENT())
        .orderBy('Order')
        .top(limit)
        .get()

      if (eventItems != null) {
        Cache.set({
          key: cachedKey,
          data: eventItems,
          expiresIn: 60 * 5 // 5 minute cache 
        });
      }
    }

    return eventItems
      .map(event => {
        const securityDataViews = split(
          get(event, 'attributeValues.securityDataViews.value', ''),
          ','
        ).filter(dv => !!dv)

        if (securityDataViews.length > 0) {
          const userInSecurityDataViews = personas.filter(({ guid }) => securityDataViews.includes(guid))
          if (userInSecurityDataViews.length === 0) {
            console.log("User does not have access to this item")
            return null
          }
        }

        return event
      })
      .filter(event => !!event)
  }

  getFeaturedEvents = () => {
    const contentChannelTypes = get(ROCK_MAPPINGS, 'CONTENT_ITEM.EventContentItem.ContentChannelTypeId', [])

    return this.request()
      .filterOneOf(contentChannelTypes.map(n => `ContentChannelTypeId eq ${n}`))
      .andFilter(this.LIVE_CONTENT())
      .andFilter('Priority gt 0') // featured events have a priority in Rock >0
      .orderBy('Priority', 'desc')
  }

  getEventByTitle = async (title) => {
    if (title === '') return null

    const contentItems = await this.getEvents()

    return find(contentItems, (n) =>
      this.formatTitleAsUrl(get(n, 'title', '')) === this.formatTitleAsUrl(title)
    )
  }

  byContentChannelId = (id) =>
    this.request()
      .filter(`ContentChannelId eq ${id}`)
      .andFilter(this.LIVE_CONTENT())
      .cache({ ttl: 60 })
      .orderBy('Order');

  generateShareUrl = ({ id: rockId, title }, parentType) => {
    const resolvedId = createGlobalId(rockId, parentType).split(":")
    const typename = resolvedId[0]
    const id = resolvedId[1]

    switch (typename) {
      case "EventContentItem":
        return `${ROCK.SHARE_URL}/events/${this.formatTitleAsUrl(title)}`;
      case "InformationalContentItem":
        return `${ROCK.SHARE_URL}/items/${id}`;
      default:
        return `${ROCK.SHARE_URL}/content/${id}`;
    }
  }

  generateShareMessage = (root) => {
    const { title } = root
    const customMessage = get(root, 'attributeValues.shareMessage.value', '')

    if (customMessage && customMessage !== "") return customMessage

    return `${title} - ${this.createSummary(root)}`
  }
}
