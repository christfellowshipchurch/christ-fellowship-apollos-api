import {
    Features as coreFeatures,
} from '@apollosproject/data-connector-rock'
import {
    get,
    take,
} from 'lodash'
import ApollosConfig from '@apollosproject/config'
import { createGlobalId } from '@apollosproject/server-core'

const { ROCK_MAPPINGS } = ApollosConfig

export default class Features extends coreFeatures.dataSource {
    // Names of Action Algoritms mapping to the functions that create the actions.
    ACTION_ALGORITHIMS = {
        // We need to make sure `this` refers to the class, not the `ACTION_ALGORITHIMS` object.
        PERSONA_FEED: this.personaFeedAlgorithmWithActionOverride.bind(this),
        CONTENT_CHANNEL: this.contentChannelAlgorithmWithActionOverride.bind(this),
        SERMON_CHILDREN: this.sermonChildrenAlgorithm.bind(this),
        UPCOMING_EVENTS: this.upcomingEventsAlgorithmWithActionOverride.bind(this),
        GLOBAL_CONTENT: this.globalContentAlgorithm.bind(this)
    }

    async globalContentAlgorithm({ index = 0, limit = null } = {}) {
        const contentChannelId = get(ROCK_MAPPINGS, 'ANNOUNCEMENTS_CHANNEL_ID', null)

        if (contentChannelId == null) {
            throw new Error(
                `A Content Channel Id is a required argument for the GLOBAL_CHANNEL ActionList algorithm.
                    Make sure you have a property inside of ROCK_MAPPINGS called ANNOUNCEMENT_CHANNEL_ID in your config.js`
            )
        }

        const { ContentItem } = this.context.dataSources;
        const cursor = ContentItem.byContentChannelId(contentChannelId).expand(
            'ContentChannel'
        ).skip(index).orderBy('Order')

        const items = limit ? await cursor.top(limit).get() : await cursor.get()

        return items.map((item, i) => ({
            id: createGlobalId(`${item.id}${i}`, 'ActionListAction'),
            title: item.title,
            subtitle: get(item, 'contentChannel.name'),
            relatedNode: { ...item, __type: ContentItem.resolveType(item) },
            image: ContentItem.getCoverImage(item),
            action: 'READ_GLOBAL_CONTENT',
        }))
    }

    async contentChannelAlgorithmWithActionOverride({ action = null, contentChannelId, limit = null } = {}) {
        const contentChannel = await this.contentChannelAlgorithm({ contentChannelId, limit })

        return !!action
            ? contentChannel.map(n => ({ ...n, action }))
            : contentChannel
    }

    async personaFeedAlgorithmWithActionOverride({ action = null } = {}) {
        const personaFeed = await this.personaFeedAlgorithm()

        return !!action
            ? personaFeed.map(n => ({ ...n, action }))
            : personaFeed
    }

    async upcomingEventsAlgorithmWithActionOverride({ action = null, contentChannelId, limit = null } = {}) {
        const eventItems = await this.context.dataSources.ContentItem.getEvents()
        const events = take(eventItems, limit)

        return events.map((event, i) => ({
            id: createGlobalId(`${event.id}${i}`, 'ActionListAction'),
            title: event.title,
            relatedNode: { ...event, __type: 'EventContentItem' },
            image: event.coverImage,
            action: action || 'READ_EVENT',
        }))
    }
}
