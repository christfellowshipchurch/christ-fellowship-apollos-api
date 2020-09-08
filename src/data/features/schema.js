import { featuresSchema } from '@apollosproject/data-schema'
import gql from 'graphql-tag'

export default gql`
    ${featuresSchema}

    extend enum ACTION_FEATURE_ACTION {
        VIEW_CHILDREN
        READ_GLOBAL_CONTENT
        READ_PRAYER
        READ_GROUP
    }

    extend type HorizontalCardListFeature {
        primaryAction: FeatureAction
    }

    type ActionBarFeatureAction {
        relatedNode: Node
        action: ACTION_FEATURE_ACTION
        title: String

        icon: String
        theme: Theme
    }

    type ActionBarFeature implements Feature & Node {
        id: ID!
        order: Int
    
        actions: [ActionBarFeatureAction]
    }

    type AvatarListFeature implements Feature & Node {
        id: ID!
        order: Int
    
        people: [Person]
        isCard: Boolean
        primaryAction: ActionBarFeatureAction
    }

    type LiveStreamListFeature implements Feature & Node {
        id: ID!
        order: Int
        title: String
        subtitle: String
        liveStreams: [LiveStream]
    }
    
    extend type Query {
        connectFeedFeatures: [Feature] @cacheControl(maxAge: 0)
        eventsFeedFeatures: [Feature] @cacheControl(maxAge: 0)
        giveFeedFeatures: [Feature] @cacheControl(maxAge: 0)
        userHeaderFeatures: [Feature] @cacheControl(maxAge: 0)
    }
`