import { featuresSchema } from '@apollosproject/data-schema'
import gql from 'graphql-tag'

// NOTE : This schema was copy-pasted from Apollos Core 1.4.0
//          It was done this way because extending enums is not
//          enabled, yet, on GraphQL.
//          In order to accomodate custom values for the ACTION_FEATURE_ACTION
//          enum, we need to write out the entire schema here
export default gql`
    interface Feature {
        id: ID!
        order: Int # 0 is the "Main Content". If order is < 0 than this comes before the body content.
    }

    enum ACTION_FEATURE_ACTION {
        READ_CONTENT
        READ_EVENT
        VIEW_CHILDREN
        READ_GLOBAL_CONTENT
    }

    type ActionListAction {
        id: ID!
        title: String
        subtitle: String
        image: ImageMedia
        relatedNode: Node
        action: ACTION_FEATURE_ACTION
    }

    type ActionListFeature implements Feature & Node {
        id: ID!
        order: Int
        title: String
        subtitle: String
        actions: [ActionListAction]
    }

    type HeroListFeature implements Feature & Node {
        id: ID!
        order: Int
        title: String
        subtitle: String
        actions: [ActionListAction]
        heroCard: CardListItem
    }

    type CardListItem {
        id: ID!
        hasAction: Boolean
        actionIcon: String
        labelText: String
        summary: String
        coverImage: ImageMedia
        title(hyphenated: Boolean): String
        relatedNode: Node
        action: ACTION_FEATURE_ACTION
    }

    type VerticalCardListFeature implements Feature & Node {
        id: ID!
        order: Int
        title: String
        subtitle: String
        isFeatured: Boolean
        cards: [CardListItem]
    }

    type HorizontalCardListFeature implements Feature & Node {
        id: ID!
        order: Int
        title: String
        subtitle: String
        cards: [CardListItem]
    }

    type TextFeature implements Feature & Node {
        id: ID!
        order: Int
        body: String
    }

    type ScriptureFeature implements Feature & Node {
        id: ID!
        order: Int
        scriptures: [Scripture]
    }

    type LiveStreamListFeature implements Feature & Node {
        id: ID!
        order: Int
        liveStreams: [LiveStream]
    }

    extend type WeekendContentItem {
        features: [Feature]
    }

    extend type ContentSeriesContentItem {
        features: [Feature]
    }
    
    extend type Query {
        userFeedFeatures: [Feature] @cacheControl(maxAge: 0)
        userHeaderFeatures: [Feature] @cacheControl(maxAge: 0)
    }
`