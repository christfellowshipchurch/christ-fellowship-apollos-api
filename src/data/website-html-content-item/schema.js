import { gql } from 'apollo-server'

export default gql`
    type WebsiteHtmlBlockItem implements ContentItem & Node {
        id: ID!
        title(hyphenated: Boolean): String
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

        feature: String
        subtitle: String

    }
`;

