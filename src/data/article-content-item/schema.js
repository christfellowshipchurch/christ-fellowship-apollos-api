import { contentItemSchema } from '@apollosproject/data-schema';
import { gql } from 'apollo-server';

export default gql`

    extend type Query {
        getArticles: [ArticleContentItem]
        getArticleByTitle(title: String!): ArticleContentItem
    }

    type ArticleContentItem implements ContentItem & Node {
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

        author: Person
        readTime: String
    }
`