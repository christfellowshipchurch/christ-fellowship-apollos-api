import ApollosConfig from '@apollosproject/config'
import { resolverMerge } from '@apollosproject/server-core'
import {
  Event as coreEvent,
} from '@apollosproject/data-connector-rock'
import {
  get,
  has,
  split,
  flatten
} from 'lodash'
import moment from 'moment'
import momentTz from 'moment-timezone'

import { parseRockKeyValuePairs } from '../utils'

const resolver = {
  Event: {
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
    start: ({ schedule, start, iCalendarContent }, args, { dataSources }) => start
      || dataSources.Event.getDateTime({ iCalendarContent }).start,
    end: ({ schedule, end, iCalendarContent }, args, { dataSources }) => end
      || dataSources.Event.getDateTime({ iCalendarContent }).end,
    location: ({ campuses, attributeValues }, args, { dataSources }) =>
      get(attributeValues, `address.value`, ''),
  }
}

export default resolverMerge(resolver, coreEvent)
