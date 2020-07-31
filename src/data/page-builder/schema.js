import gql from 'graphql-tag'

export default gql`
    enum CONTENT_BLOCK_DISPLAY {
        LEFT
        RIGHT
        TOP
        BOTTOM
        BACKGROUND_IMAGE
    }

    enum PAGE_BUILDER_FEATURE_ACTION {
        VIEW_MORE
    }

    type PageBuilderAction {
        title: String
        action: PAGE_BUILDER_FEATURE_ACTION
    }

    interface PageBuilderFeature {
        id: ID!
        order: Int
    }

    type ContentBlockItem {
        title: String
        subtitle: String
        htmlContent: String
        image: ImageMedia
        callsToAction: [CallToAction]
    }

    type ContentBlockFeature implements PageBuilderFeature & Node {
        id: ID!
        order: Int

        content: ContentBlockItem
        display: CONTENT_BLOCK_DISPLAY
    }
    
    type ContentGridFeature implements PageBuilderFeature & Node {
        id: ID!
        order: Int

        title: String
        subtitle: String
        blocks: [ContentBlockItem]
        primaryAction: PageBuilderAction
    }

    type CampusContentFeature implements PageBuilderFeature & Node {
        id: ID!
        order: Int

        campus: Campus
        action: PageBuilderAction
    }

    type MetadataFeature implements PageBuilderFeature & Node {
        id: ID!
        order: Int

        title: String
        meta: [Metadata]
    }

    extend type Query {
        pageBuilderFeatures(url: String!): [PageBuilderFeature]
    }
`