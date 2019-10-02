import { contentItemSchema } from '@apollosproject/data-schema'
import { gql } from 'apollo-server'

export default gql`
    type CallToAction {
        call: String
        action: String
    }

    type WebsiteBlockItem implements ContentItem & Node {
        id: ID!
        title: String
        coverImage: ImageMedia
        images: [ImageMedia]
        videos: [VideoMedia]
        audios: [AudioMedia]
        htmlContent: String
        summary: String
        childContentItemsConnection(
            first: Int
            after: String
        ): ContentItemsConnection
        siblingContentItemsConnection(
            first: Int
            after: String
        ): ContentItemsConnection
        parentChannel: ContentChannel
        theme: Theme

        contentLayout: String
        imageAlt: String
        imageRatio: String
        callToAction: CallToAction
        secondaryCallToAction: CallToAction
        target: String
        subtitle: String

        openLinksInNewTab: Boolean
    }
`