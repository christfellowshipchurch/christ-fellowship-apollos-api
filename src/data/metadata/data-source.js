import { dataSource as definedValueDataDataSource } from '../defined-value'
import ApollosConfig from '@apollosproject/config'
import { parseGlobalId } from '@apollosproject/server-core'
import {
  get,
  find,
  kebabCase,
  toLower,
  upperCase,
} from 'lodash'

import { createVideoUrlFromGuid, getIdentifierType, parseRockKeyValuePairs } from '../utils'

const { ROCK_MAPPINGS } = ApollosConfig

export default class Metadata extends definedValueDataDataSource {

  parseDefinedValue = (definedValue) => {
    const attributeValues = get(definedValue, 'attributeValues')

    if (attributeValues) {
      const description = get(definedValue, 'description', '')
      const keywords = get(attributeValues, 'keywords.value', '').replace(/\|/g, ',')
      const tags = get(attributeValues, 'tags.value', '')

      return [
        { name: "description", content: description },
        { name: "keywords", content: keywords },
        ...(parseRockKeyValuePairs(tags, 'content', 'name'))
      ].filter(obj => obj.content !== '')
    }

    return []
  }

  getByRelatedNode = async (relatedNode) => {
    if (relatedNode.includes("ContentItem")) {
      const { id } = parseGlobalId(relatedNode)
      const contentItem = await this.context.dataSources.ContentItem.getFromId(id)
      const definedValueGuid = get(contentItem, 'attributeValues.metadata.value', '')

      if (definedValueGuid && definedValueGuid !== '') {
        const definedValue = await this.getByIdentifier(definedValueGuid)

        return this.parseDefinedValue(definedValue)
      }
    }

    return []
  }
}
