import { contentItemSchema } from '@apollosproject/data-schema';
import { gql } from 'apollo-server';

export default gql`
    extend type Query {
        getWebsitePageContentByTitle(website: String!, title: String!): WebsitePagesContentItem
    }

    type MetaTag {
        name: String
        content: String
    }

    type WebsitePagesItem implements ContentItem & Node {
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

        metaDescription: String
        metaKeywords: [String]
        openGraphProtocols: [MetaTag]
        twitterProtocols: [MetaTag]
    }
`;