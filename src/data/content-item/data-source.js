import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
  get,
  find,
  kebabCase,
  toLower,
} from 'lodash'

import { createVideoUrlFromGuid } from '../utils'

const { ROCK_MAPPINGS } = ApollosConfig

export default class ContentItem extends coreContentItem.dataSource {

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
    }));
  }

  // title pattern should follow: the-article-title
  getByTitle = async (title) => {
    const contentChannels = get(ROCK_MAPPINGS, 'BROWSE_CONTENT_CHANNEL_IDS', [])

    if (title === '' || contentChannels.length === 0) return null

    const contentItems = await this.request(`ContentChannelItems`)
      .filterOneOf(contentChannels.map(n => `ContentChannelId eq ${n}`))
      .get()

    return find(contentItems, (n) =>
      this.formatTitleAsUrl(get(n, 'title', '')) === this.formatTitleAsUrl(title)
    )
  }
}