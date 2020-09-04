import {
    Feature as coreFeatures,
    Utils
} from '@apollosproject/data-connector-rock'
import {
    get,
    split
} from 'lodash'
import moment from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'
import { createGlobalId } from '@apollosproject/server-core'
import { printIntrospectionSchema } from 'graphql'

const { ROCK_MAPPINGS, FEATURE_FLAGS, ROCK } = ApollosConfig
const { createImageUrlFromGuid } = Utils

export default class Feature extends coreFeatures.dataSource {
    expanded = true

    /** Base Attrs and Methods from the Core DataSource */
    baseAlgorithms = this.ACTION_ALGORITHIMS;

    // Names of Action Algoritms mapping to the functions that create the actions.
    ACTION_ALGORITHIMS = Object.entries({
        ...this.baseAlgorithms,
        // We need to make sure `this` refers to the class, not the `ACTION_ALGORITHIMS` object.
        ALL_EVENTS: this.allEventsAlgorithm,
        ALL_LIVE_CONTENT: this.allLiveStreamContentAlgorithm,
        CONTENT_CHANNEL: this.contentChannelAlgorithmWithActionOverride,
        CONTENT_CHILDREN: this.contentChildrenAlgorithm,
        GLOBAL_CONTENT: this.globalContentAlgorithm,
        MY_PRAYERS: this.myPrayersAlgorithm,
        PERSONA_FEED: this.personaFeedAlgorithmWithActionOverride,
        ROCK_DYNAMIC_FEED: this.rockDynamicFeed,
        SERMON_CHILDREN: this.sermonChildrenAlgorithm,
        UPCOMING_EVENTS: this.upcomingEventsAlgorithmWithActionOverride,
    }).reduce((accum, [key, value]) => {
        // convenciance code to make sure all methods are bound to the Features dataSource
        // eslint-disable-next-line
        accum[key] = value.bind(this);
        return accum;
    }, {})

    /** Algorithms */
    async allEventsAlgorithm() {
        const { ContentItem } = this.context.dataSources

        const items = await ContentItem.getEvents()

        return items.map((item, i) => ({
            id: createGlobalId(`${item.id}${i}`, 'ActionListAction'),
            title: item.title,
            relatedNode: { ...item, __type: ContentItem.resolveType(item) },
            image: ContentItem.getCoverImage(item),
            action: 'READ_CONTENT',
            summary: ContentItem.createSummary(item),
        }));
    }

    async allLiveStreamContentAlgorithm() {
        const { LiveStream } = this.context.dataSources;
        const liveStreams = await LiveStream.getLiveStreams();
        return liveStreams;
    }

    async contentChannelAlgorithmWithActionOverride({ action = null, contentChannelId, limit = null } = {}) {
        const contentChannel = await this.contentChannelAlgorithm({ contentChannelId, limit })

        return !!action
            ? contentChannel.map(n => ({ ...n, action }))
            : contentChannel
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

    async myPrayersAlgorithm({ limit = 5 } = {}) {
        const { PrayerRequest, Person } = this.context.dataSources;
        const cursor = await PrayerRequest.byCurrentUser();
        const items = await cursor.top(limit).get();

        return items.map((item, i) => {
            const getProfileImage = async () => {
                const root = await Person.getFromAliasId(item.requestedByPersonAliasId)

                const guid = get(root, 'photo.guid')

                return {
                    sources: [
                        (guid && guid !== ''
                            ? { uri: createImageUrlFromGuid(guid) }
                            : { uri: "https://cloudfront.christfellowship.church/GetImage.ashx?guid=0ad7f78a-1e6b-46ad-a8be-baa0dbaaba8e" })
                    ]
                }
            }

            return ({
                id: createGlobalId(`${item.id}${i}`, 'ActionListAction'),
                title: item.text,
                relatedNode: {
                    __type: "PrayerRequest",
                    ...item
                },
                image: getProfileImage(),
                action: 'READ_PRAYER',
                subtitle: moment(item.enteredDateTime)
                    .tz(ROCK.TIMEZONE)
                    .utc()
                    .format(),
            })
        });
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

    /** Create Features */
    createActionRowFeature({ actions }) {
        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
                type: 'ActionBarFeature',
                args: {
                    actions
                },
            }),
            actions: actions.map(action => {
                // Ensures that we have a generated ID for the Primary Action related node, if not provided.
                if (
                    action &&
                    action.relatedNode &&
                    !action.relatedNode.id
                ) {
                    action.relatedNode.id = createGlobalId( // eslint-disable-line
                        JSON.stringify(action.relatedNode),
                        action.relatedNode.__typename
                    );
                }

                return action
            }),
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'ActionBarFeature',
        };
    }

    async createHorizontalCardListFeature({
        algorithms = [],
        hyphenatedTitle,
        title,
        subtitle,
        primaryAction
    }) {
        // Generate a list of horizontal cards.
        const cards = () => this.runAlgorithms({ algorithms });

        // Ensures that we have a generated ID for the Primary Action related node, if not provided.
        if (
            primaryAction &&
            primaryAction.relatedNode &&
            !primaryAction.relatedNode.id
        ) {
            primaryAction.relatedNode.id = createGlobalId( // eslint-disable-line
                JSON.stringify(primaryAction.relatedNode),
                primaryAction.relatedNode.__typename
            );
        }

        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
                type: 'HorizontalCardListFeature',
                args: {
                    algorithms,
                    title,
                    subtitle,
                },
            }),
            cards,
            hyphenatedTitle,
            title,
            subtitle,
            primaryAction,
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'HorizontalCardListFeature',
        };
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

    /** Create Feeds */
    getEventsFeedFeatures() {
        return this.getFeedFeatures(get(ApollosConfig, 'FEATURE_FEEDS.EVENTS_TAB', []));
    }

    async getFeedFeatures(features) {
        return Promise.all(
            features.map((featureConfig) => {
                switch (featureConfig.type) {
                    case 'VerticalCardList':
                        return this.createVerticalCardListFeature(featureConfig);
                    case 'HorizontalCardList':
                        return this.createHorizontalCardListFeature(featureConfig);
                    case 'HeroList':
                        return this.createHeroListFeature(featureConfig);
                    case 'PrayerList':
                        return this.createPrayerListFeature(featureConfig);
                    case 'ActionBar':
                        return this.createActionRowFeature(featureConfig);
                    case 'ActionList':
                    default:
                        // Action list was the default in 1.3.0 and prior.
                        return this.createActionListFeature(featureConfig);
                }
            })
        );
    }

    getGiveFeedFeatures() {
        return this.getFeedFeatures(get(ApollosConfig, 'FEATURE_FEEDS.GIVE_TAB', []));
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
                        return this.createActionListFeature(featureConfig);
                }
            })
        );
    }

    getConnectFeedFeatures() {
        return this.getFeedFeatures(get(ApollosConfig, 'FEATURE_FEEDS.CONNECT_TAB', []));
    }

    async getRockFeedFeatures({ contentChannelId }) {
        if (!contentChannelId) {
            return []
        }

        const { ContentItem, Person } = this.context.dataSources;
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
                console.log({ e })
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

    async rockDynamicFeed({ contentChannelId = null }) {
        console.warn(
            'Deprecated: Please use the name "getRockFeedFeatures" instead. You used "rockDynamicFeed"'
        );
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
}
