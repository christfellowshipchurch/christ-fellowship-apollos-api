import {
    Feature as coreFeatures,
    Utils
} from '@apollosproject/data-connector-rock'
import {
    get,
    split,
    flattenDeep,
} from 'lodash'
import moment from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'

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
        CURRENT_USER: this.currentUserAlgorithm,
        CURRENT_USER_FAMILY: this.currentUserFamilyAlgorithm,
        GLOBAL_CONTENT: this.globalContentAlgorithm,
        MY_GROUPS: this.myGroupsAlgorithm,
        MY_PRAYERS: this.myPrayersAlgorithm,
        MY_VOLUNTEER_GROUPS: this.myVolunteerGroupsAlgorithm,
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

    // MARK : - Algorithms
    async allEventsAlgorithm() {
        const { ContentItem } = this.context.dataSources

        const items = await ContentItem.getEvents()

        return items.map((item, i) => ({
            id: `${item.id}${i}`,
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

    async currentUserAlgorithm() {
        const { Auth } = this.context.dataSources

        return Auth.getCurrentPerson()
    }

    async currentUserFamilyAlgorithm() {
        // Get the spouse first and then display the children underneath
        const { Person } = this.context.dataSources
        const family = await Promise.all([
            Person.getSpouseByUser(),
            Person.getChildrenByUser(),
        ])

        return flattenDeep(family).filter(p => !!p)
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
            id: `${item.id}${i}`,
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
            id: `${item.id}${i}`,
            title: item.title,
            subtitle: get(item, 'contentChannel.name'),
            relatedNode: { ...item, __type: ContentItem.resolveType(item) },
            image: ContentItem.getCoverImage(item),
            action: 'READ_GLOBAL_CONTENT',
        }))
    }

    async myGroupsAlgorithm({ limit = null } = {}) {
        const { Group, Auth, ContentItem } = this.context.dataSources

        try {
            // Exclude Dream Team
            const groupTypeKeys = Object.keys(Group.groupTypeMap).filter(key => key !== "DreamTeam")
            const groupTypeIds = groupTypeKeys.map(key => Group.groupTypeMap[key])

            const { id } = await Auth.getCurrentPerson()
            const groups = await Group.getByPerson({ personId: id, groupTypeIds })

            return groups.map((item, i) => {
                const getScheduleFriendlyText = async () => {
                    const schedule = await Group.getScheduleFromId(item.scheduleId)

                    return schedule.friendlyScheduleText
                }

                return ({
                    id: `${item.id}${i}`,
                    title: Group.getTitle(item),
                    relatedNode: {
                        __type: Group.resolveType(item),
                        ...item
                    },
                    image: ContentItem.getCoverImage(item),
                    action: 'READ_GROUP',
                    subtitle: getScheduleFriendlyText()
                })
            });
        } catch (e) {
            console.log("Error getting Groups for current user. User likely not logged in", { e })
        }

        return []
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
                id: `${item.id}${i}`,
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

    async myVolunteerGroupsAlgorithm({ limit = null } = {}) {
        const { Group, Auth } = this.context.dataSources

        try {
            const { id } = await Auth.getCurrentPerson()
            const groups = await Group.getByPerson({
                type: "DreamTeam",
                personId: id,
            })

            return groups.map((item, i) => {
                return ({
                    id: `${item.id}${i}`,
                    title: Group.getTitle(item),
                    relatedNode: {
                        __type: Group.resolveType(item),
                        ...item
                    },
                    image: null,
                    action: 'READ_GROUP',
                    subtitle: ""
                })
            });
        } catch (e) {
            console.log("Error getting Groups for current user. User likely not logged in", { e })
        }

        return []
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
            id: `${event.id}${i}`,
            title: event.title,
            relatedNode: { ...event, __type: 'EventContentItem' },
            image: event.coverImage,
            action: action || 'READ_EVENT',
        }))
    }

    /** Create Features */
    createActionBarFeature({ actions }) {
        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
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
                    action.relatedNode.id = this.createFeatureId({ args: action.relatedNode});
                }

                return action
            }),
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'ActionBarFeature',
        };
    }

    async createAvatarListFeature({ algorithms, primaryAction, isCard }) {
        const people = this.runAlgorithms({ algorithms });

        // Ensures that we have a generated ID for the Primary Action related node, if not provided.
        if (
            primaryAction &&
            primaryAction.relatedNode &&
            !primaryAction.relatedNode.id
        ) {
            primaryAction.relatedNode.id = this.createFeatureId({ args: primaryAction.relatedNode });
        }

        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
                args: {
                    algorithms,
                    primaryAction,
                    isCard
                },
            }),
            people,
            isCard,
            primaryAction,
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'AvatarListFeature',
        };
    }

    async createHorizontalCardListFeature({
        algorithms = [],
        hyphenatedTitle,
        title,
        subtitle,
        primaryAction,
        cardType
    }) {
        const cards = this.runAlgorithms({ algorithms });

        // Ensures that we have a generated ID for the Primary Action related node, if not provided.
        if (
            primaryAction &&
            primaryAction.relatedNode &&
            !primaryAction.relatedNode.id
        ) {
            primaryAction.relatedNode.id = this.createFeatureId({ args: primaryAction.relatedNode });
        }

        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
                args: {
                    algorithms,
                    title,
                    subtitle,
                    cardType
                },
            }),
            cards,
            hyphenatedTitle,
            title,
            subtitle,
            primaryAction,
            cardType,
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'HorizontalCardListFeature',
        };
    }

    async createLiveStreamListFeature({ algorithms, title, subtitle }) {
        const liveStreams = this.runAlgorithms({ algorithms });

        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
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
        const { Flag } = this.context.dataSources
        const featuresFilteredByPermissions = await Promise.all(features
            .map(async (feature) => {
                const flagKey = get(feature, 'flagKey')

                if (flagKey) {
                    const status = await Flag.currentUserCanUseFeature(flagKey)

                    if (status !== "LIVE") return null
                }

                return feature
            }))

        return Promise.all(
            featuresFilteredByPermissions
                .filter(feature => !!feature)
                .map((featureConfig) => {
                    switch (featureConfig.type) {
                        case 'ActionBar':
                            return this.createActionBarFeature(featureConfig);
                        case 'AvatarList':
                            return this.createAvatarListFeature(featureConfig);
                        case 'HeroList':
                            return this.createHeroListFeature(featureConfig);
                        case 'HorizontalCardList':
                            return this.createHorizontalCardListFeature(featureConfig);
                        case 'PrayerList':
                            return this.createPrayerListFeature(featureConfig);
                        case 'VerticalCardList':
                            return this.createVerticalCardListFeature(featureConfig);
                        case 'ActionList':
                        default:
                            // Action list was the default in 1.3.0 and prior.
                            return this.createActionListFeature(featureConfig);
                    }
                })
        );
    }

    getGiveFeedFeatures() {
        const { clientVersion } = this.context;
        const versionParse = split(clientVersion, '.').join('')
        const config = get(ApollosConfig, 'FEATURE_FEEDS.GIVE_TAB', [])
        const pushPayConfig = {
            action: 'OPEN_URL',
            title: "PushPay",
            icon: "push-pay",
            theme: {
                colors: {
                    primary: "#d52158"
                }
            },
            relatedNode: {
                __typename: 'Url',
                url: "https://cf.church/pushpay"
            }
        }
        const payPalConfig = {
            action: 'OPEN_URL',
            title: "PayPal",
            icon: "pay-pal",
            theme: {
                colors: {
                    primary: "#179bd7"
                }
            },
            relatedNode: {
                __typename: 'Url',
                url: "http://cf.church/paypal"
            }
        }
        const cashAppConfig = {
            action: 'OPEN_URL',
            title: "CashApp",
            icon: "cash-app",
            theme: {
                colors: {
                    primary: "#1ec27f"
                }
            },
            relatedNode: {
                __typename: 'Url',
                url: "http://cf.church/cash-app"
            }
        }
        const venmoConfig = {
            action: 'OPEN_URL',
            title: "Venmo",
            icon: "venmo",
            theme: {
                colors: {
                    primary: "#00aeef"
                }
            },
            relatedNode: {
                __typename: 'Url',
                url: "http://cf.church/venmo"
            }
        }

        const actionIndex = config.findIndex(item => item.type === 'ActionBar')

        if (parseInt(versionParse) >= 540) {
            config[actionIndex].actions = [pushPayConfig, payPalConfig, cashAppConfig, venmoConfig]
        } else {
            pushPayConfig.icon = "envelope-open-dollar"
            config[actionIndex].actions = [pushPayConfig]
        }

        console.log({config: config[1].actions})

        return this.getFeedFeatures(config);
    }

    async getHomeHeaderFeedFeatures() {
        return Promise.all(
            get(ApollosConfig, 'FEATURE_FEEDS.HOME_HEADER', []).map((featureConfig) => {
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
                                    contentChannelItemId: item.id,
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
                id: `${item.id}${i}`,
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
