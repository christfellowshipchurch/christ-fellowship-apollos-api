import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import { Utils } from '@apollosproject/data-connector-rock'
import {
  isEmpty,
  camelCase,
  get,
  first,
  filter as lodashFilter,
  split,
  intersection
} from 'lodash'
import { createVideoUrlFromGuid } from '../utils'

const { createImageUrlFromGuid } = Utils
const { ROCK_MAPPINGS } = ApollosConfig

const sortCategoryContentChannelItems = ({
  sortOrder,
  contentChannelItems
}) => {
  // Sort order could be undefined or have no ids. There's no reason to iterate in this case.
  if (!sortOrder || isEmpty(sortOrder)) {
    return contentChannelItems
  }
  // Setup a result array.
  const result = []
  sortOrder.forEach((configId) => {
    // Remove the matched element from the channel list.
    const channel = contentChannelItems.splice(
      contentChannelItems.findIndex(({ id }) => id === configId),
      1
    )
    // And then push it (or nothing) to the end of the result array.
    result.push(...channel)
  })
  // Return results and any left over contentChannelItems.
  return [...result, ...contentChannelItems]
}

export default class Browse extends RockApolloDataSource {
  expanded = true

  getFilterItem = async ({ filter }) => {
    // All Filters as Content Channel Items
    const contentChannelItems = await this.request('ContentChannelItems')
      .filter(
        ROCK_MAPPINGS.DISCOVER_CONTENT_CHANNEL_IDS.map(
          (channelId) => `(ContentChannelId eq ${channelId})`
        ).join(' or ')
      )
      .cache({ ttl: 5 })
      .get()

    // Single Content Channel Item of the Filter
    return first(contentChannelItems.filter(n =>
      camelCase(get(n, 'title', '')) === camelCase(filter)
    ))
  }

  getAllCategories = async () => {
    const contentChannelItems = await this.request('ContentChannelItems')
      .filter(
        ROCK_MAPPINGS.BROWSE_CATEGORY_CONTENT_CHANNEL_IDS.map(
          (channelId) => `(ContentChannelId eq ${channelId})`
        ).join(' or ')
      )
      .cache({ ttl: 5 })
      .get()

    return sortCategoryContentChannelItems({
      contentChannelItems,
      sortOrder: ROCK_MAPPINGS.BROWSE_CATEGORY_CONTENT_CHANNEL_IDS
    })

  }

  getCategories = async (filter) => {
    const parentItem = await this.getFilterItem({ filter })

    // Array of GUIDs from Rock for the Defined Value
    // const mediaTypes = get(parentItem, 'attributeValues.contentTypes', '').split('')

    const childAssociations = await this.request(
      'ContentChannelItemAssociations'
    )
      .filter(`ContentChannelItemId eq ${parentItem.id}`)
      .get()

    if (!childAssociations || !childAssociations.length) return []

    const childIds = childAssociations.map(({ childContentChannelItemId }) => childContentChannelItemId)
    const children = await this.context.dataSources.ContentItem.getFromIds(childIds).get()

    return children
  }

  getBrowseContent = async ({ category, filter }) => {
    const allCategories = await this.getAllCategories()
    const categoryItem = first(lodashFilter(
      allCategories,
      n => camelCase(n.title) === camelCase(category)
    ))
    let mediaTypes = []

    // if filter,
    if (!!filter) {
      const filterItem = await this.getFilterItem({ filter })

      // check that the category is actually in this filter
      const parentAssociations = await this.request(
        'ContentChannelItemAssociations'
      )
        .filter([
          `(ChildContentChannelItemId eq ${categoryItem.id})`,
          `(ContentChannelItemId eq ${filterItem.id})`
        ].join(" and "))
        .get()

      console.log({ categoryItem, filterItem, parentAssociations })

      if (parentAssociations.length === 0) return []

      // get the media types this filter allows
      mediaTypes = split(get(filterItem, 'attributeValues.contentTypes.value', ''), ',')
    }

    // return children of category
    const childAssociations = await this.request(
      'ContentChannelItemAssociations'
    )
      .filter(`ContentChannelItemId eq ${categoryItem.id}`)
      .get()

    if (!childAssociations || !childAssociations.length) return []

    const childIds = childAssociations.map(({ childContentChannelItemId }) => childContentChannelItemId)
    const children = await this.context.dataSources.ContentItem.getFromIds(childIds).get()

    return mediaTypes.length
      ? lodashFilter(children, n => {
        const itemMediaTypes = split(get(n, 'attributeValues.contentTypes.value', ''), ',')
        const intersectedFilters = intersection(mediaTypes, itemMediaTypes)

        console.log({ mediaTypes, itemMediaTypes, intersectedFilters })

        return intersectedFilters.length > 0
      })
      : children
  }
}