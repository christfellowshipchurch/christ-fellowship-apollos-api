import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
  get,
  find,
  kebabCase,
  toLower,
  upperCase,
} from 'lodash'

import { createVideoUrlFromGuid, getIdentifierType } from '../utils'

const { ROCK_MAPPINGS } = ApollosConfig

export default class ContentItem extends coreContentItem.dataSource {
  expanded = true

  resolveType(props) {
    const {
      attributeValues,
      attributes,
    } = props

    // if (this.hasRedirect({ attributeValues, attributes })) {
    //   return 'LinkContentItem'
    // }

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

  getEvents = (limit) => {
    const contentChannelTypes = get(ROCK_MAPPINGS, 'CONTENT_ITEM.EventContentItem.ContentChannelTypeId', [])

    if (contentChannelTypes.length === 0) {
      console.warn(
        'No Content Channel Types were found for events'
      )
      return null
    }

    return this.request(`ContentChannelItems`)
      .filterOneOf(contentChannelTypes.map(n => `ContentChannelTypeId eq ${n}`))
      .andFilter(this.LIVE_CONTENT())
      .orderBy('Order')
      .top(limit)
      .get()
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
}
