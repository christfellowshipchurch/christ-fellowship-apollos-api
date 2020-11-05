import { resolverMerge, createGlobalId } from '@apollosproject/server-core'
import {
  Event as coreEvent,
} from '@apollosproject/data-connector-rock'
import {
  get,
  split,
} from 'lodash'

const resolver = {
  Event: {
    id: ({ id, start, end }, args, context, { parentType }) =>
      createGlobalId(JSON.stringify({ id, start, end }), parentType.name),
    name: ({ name }, args, { dataSources }) =>
      name,
    description: ({ description }, args, { dataSources }) =>
      description,
    campuses: ({ campuses, attributeValues }, args, { dataSources }) => {
      const campusGuids = split(
        get(attributeValues, `campuses.value`, ''),
        ','
      ).filter(n => n !== '')

      return campusGuids.length
        ? dataSources.Campus.getFromIds(campusGuids)
        : []
    },
    start: ({ start }) => start,
    end: ({ end }) => end,
    location: ({ campuses, attributeValues }, args, { dataSources }) =>
      get(attributeValues, `address.value`, ''),
  }
}

export default resolverMerge(resolver, coreEvent)
