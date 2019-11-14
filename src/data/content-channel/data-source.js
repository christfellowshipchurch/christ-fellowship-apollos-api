import { ContentChannel as coreContentChannel } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import {
  isEmpty
} from 'lodash'

import { createVideoUrlFromGuid } from '../utils'

const { ROCK_MAPPINGS } = ApollosConfig

export default class ContentChannel extends coreContentChannel.dataSource {
  getEventChannels = () => {

  }

  getContentChannelsFromIds = async (ids) => {
    const channels = await this.request()
      .filter(
        ids.map(
          (channelId) => `(Id eq ${channelId})`
        ).join(' or ')
      )
      .cache({ ttl: 5 })
      .get()

    const sortOrder = ids
    // Sort order could be undefined or have no ids. There's no reason to iterate in this case.
    if (!sortOrder || isEmpty(sortOrder)) {
      return channels
    }
    // Setup a result array.
    const result = []
    sortOrder.forEach((configId) => {
      // Remove the matched element from the channel list.
      const channel = channels.splice(
        channels.findIndex(({ id }) => id === configId),
        1
      )
      // And then push it (or nothing) to the end of the result array.
      result.push(...channel)
    })
    // Return results and any left over channels.
    return [...result, ...channels]
  }
}