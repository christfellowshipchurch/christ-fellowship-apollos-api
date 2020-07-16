import {
    Feature as coreFeatures,
} from '@apollosproject/data-connector-rock'
import {
    get,
    split
} from 'lodash'
import ApollosConfig from '@apollosproject/config'
import { createGlobalId } from '@apollosproject/server-core'

const { ROCK_MAPPINGS, FEATURE_FLAGS } = ApollosConfig

export default class Feature extends coreFeatures.dataSource {
    expanded = true

    // Names of Action Algoritms mapping to the functions that create the actions.
    baseAlgorithms = this.ACTION_ALGORITHIMS;
    ACTION_ALGORITHIMS = Object.entries({
        ...this.baseAlgorithms,
        // We need to make sure `this` refers to the class, not the `ACTION_ALGORITHIMS` object.
        PERSONA_FEED: this.personaFeedAlgorithmWithActionOverride,
        CONTENT_CHANNEL: this.contentChannelAlgorithmWithActionOverride,
        SERMON_CHILDREN: this.sermonChildrenAlgorithm,
        UPCOMING_EVENTS: this.upcomingEventsAlgorithmWithActionOverride,
        GLOBAL_CONTENT: this.globalContentAlgorithm,
        ROCK_DYNAMIC_FEED: this.rockDynamicFeed,
        ALL_LIVE_CONTENT: this.allLiveStreamContentAlgorithm,
        CONTENT_CHILDREN: this.contentChildrenAlgorithm,
    }).reduce((accum, [key, value]) => {
        // convenciance code to make sure all methods are bound to the Features dataSource
        // eslint-disable-next-line
        accum[key] = value.bind(this);
        return accum;
    }, {})

    async rockDynamicFeed({ contentChannelId = null }) {
        if (!contentChannelId) {
            return []
        }

        const usePersonas = FEATURE_FLAGS.ROCK_DYNAMIC_FEED_WITH_PERSONAS.status === "LIVE"
        const { ContentItem, Person } = this.context.dataSources;
        const contentChannelItems = await this.request('ContentChannelItems')
            .filter(`ContentChannelId eq ${contentChannelId}`)
            .andFilter(ContentItem.LIVE_CONTENT())
            .cache({ ttl: 60 })
            .orderBy('Order', 'asc')
            .get()
        let personas = []

        if (usePersonas) {
            try {
                personas = await Person.getPersonas({ categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId })
            } catch (e) {
                console.log("Rock Dynamic Feed: Unable to retrieve personas for user.")
            }
        }

        const actions = contentChannelItems.map((item, i) => {
            const action = get(item, 'attributeValues.action.value', '')

            if (!action || action === '' || !item.id) return null
            const securityDataViews = split(
                get(item, 'attributeValues.securityDataViews.value', ''),
                ','
            ).filter(dv => !!dv)

            if (securityDataViews.length > 0) {
                const userInSecurityDataViews = personas.filter(({ guid }) => securityDataViews.includes(guid))
                if (userInSecurityDataViews.length === 0) {
                    console.log("User does not have access to this item")
                    return null
                }
            }

            return {
                id: createGlobalId(`${item.id}${i}`, 'ActionListAction'),
                title: item.title,
                subtitle: get(item, 'contentChannel.name'),
                relatedNode: { ...item, __type: ContentItem.resolveType(item) },
                image: ContentItem.getCoverImage(item),
                action,
            }
        })

        return actions.filter(action => !!action)
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
        const events = await this.context.dataSources.ContentItem.getEvents(limit)

        return events.map((event, i) => ({
            id: createGlobalId(`${event.id}${i}`, 'ActionListAction'),
            title: event.title,
            relatedNode: { ...event, __type: 'EventContentItem' },
            image: event.coverImage,
            action: action || 'READ_EVENT',
        }))
    }

    async createLiveStreamListFeature({ algorithms, title, subtitle }) {
        const liveStreams = () => this.runAlgorithms({ algorithms });
        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
                type: 'LiveStreamListFeature',
                args: {
                    algorithms,
                    title,
                    subtitle
                },
            }),
            title,
            subtitle,
            liveStreams,
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'LiveStreamListFeature',
        };
    }

    async allLiveStreamContentAlgorithm() {
        const { LiveStream } = this.context.dataSources;
        const liveStreams = await LiveStream.getLiveStreams();
        return liveStreams;
    }

    async contentChildrenAlgorithm({ contentChannelItemId, limit = 10 }) {
        const { ContentItem } = this.context.dataSources;
        const cursor = (await ContentItem.getCursorByParentContentItemId(
            contentChannelItemId
        )).expand('ContentChannel');
        const items = limit ? await cursor.top(limit).get() : await cursor.get();

        return items.map((item, i) => ({
            id: createGlobalId(`${item.id}${i}`, 'ActionListAction'),
            title: item.title,
            subtitle: ContentItem.createSummary(item),
            relatedNode: { ...item, __type: ContentItem.resolveType(item) },
            image: ContentItem.getCoverImage(item),
            action: 'READ_CONTENT',
            summary: ContentItem.createSummary(item),
        }));
    }

    async getRockFeedFeatures({ contentChannelId }) {
        if (!contentChannelId) {
            return []
        }

        const { ContentItem } = this.context.dataSources;
        const contentChannelItems = await this.request('ContentChannelItems')
            .filter(`ContentChannelId eq ${contentChannelId}`)
            .andFilter(ContentItem.LIVE_CONTENT())
            .cache({ ttl: 60 })
            .orderBy('Order', 'asc')
            .get()

        // TODO : remove when this is merged [https://github.com/ApollosProject/apollos-plugin/pull/2]
        const usePersonas = FEATURE_FLAGS.ROCK_DYNAMIC_FEED_WITH_PERSONAS.status === "LIVE"
        let personas = []
        if (usePersonas) {
            try {
                personas = await Person.getPersonas({ categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId })
            } catch (e) {
                console.log("Rock Dynamic Feed: Unable to retrieve personas for user.")
            }
        }
        const filteredContentChannelItems = contentChannelItems.filter(item => {
            // TODO : remove when this is merged [https://github.com/ApollosProject/apollos-plugin/pull/2]
            const securityDataViews = split(
                get(item, 'attributeValues.securityDataViews.value', ''),
                ','
            ).filter(dv => !!dv)

            if (securityDataViews.length > 0) {
                const userInSecurityDataViews = personas.filter(({ guid }) => securityDataViews.includes(guid))
                if (userInSecurityDataViews.length === 0) {
                    console.log("User does not have access to this item")
                    return false
                }
            }

            return true
        })

        return Promise.all(
            filteredContentChannelItems.map((item) => {
                const action = get(item, 'attributeValues.action.value', '')

                switch (action) { // TODO : support multiple algorithms from Rock
                    case 'VIEW_CHILDREN': // deprecated, old action
                    case 'HeroList':
                        return this.createHeroListFeature({
                            algorithms: [{
                                type: "CONTENT_CHILDREN",
                                arguments: {
                                    contentChannelItemId: item.id
                                }
                            }],
                            title: item.title,
                            subtitle: ContentItem.createSummary(item),
                        })
                    case 'READ_GLOBAL_CONTENT': // deprecated, old action
                    case 'VerticalCardList':
                    default:
                        // VerticalCardList with the CONTENT_CHILDREN as default
                        return this.createVerticalCardListFeature({
                            algorithms: [{
                                type: "CONTENT_CHILDREN",
                                arguments: {
                                    contentChannelItemId: item.id
                                }
                            }],
                            title: item.title,
                            subtitle: ContentItem.createSummary(item),
                        });
                }
            })
        );
    }

    async getHomeHeaderFeedFeatures() {
        return Promise.all(
            get(ApollosConfig, 'HOME_HEADER_FEATURES', []).map((featureConfig) => {
                switch (featureConfig.type) {
                    case 'PrayerList':
                        return this.createPrayerListFeature(featureConfig);
                    case 'LiveContentList':
                        return this.createLiveStreamListFeature(featureConfig);
                    case 'ActionList':
                    default:
                        // Action list was the default in 1.3.0 and prior.
                        return this.createActionListFeature(featureConfig);
                }
            })
        );
    }
}
