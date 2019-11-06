import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { Utils } from '@apollosproject/data-connector-rock'
import { get, split } from 'lodash'

const { createImageUrlFromGuid } = Utils
import { createVideoUrlFromGuid } from '../utils'

export default class ContentItem extends coreContentItem.dataSource {
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

  getDecorations = async ({ id }) => {
    if (!!id) {
      const contentItem = await this.getFromId(id)

      return {
        tags: split(get(contentItem, 'attributeValues.tags.value', ''), ','),
        icon: get(contentItem, 'attributeValues.icon.value', '')
      }
    }

    return null
  }
}