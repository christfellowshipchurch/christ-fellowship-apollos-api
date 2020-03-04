import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  extend type Query {
    getEventContentByTitle(title:String!): EventContentItem
  }

  type EventContentItem implements ContentItem & Node {
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

    nextOccurrence: String
    startDate: String
    endDate: String

    tags: [String]
    callsToAction: [CallToAction]
    openLinksInNewTab: Boolean

    events: [Event]
  }
`


// sharing: SharableContentItem
//     isLiked: Boolean @cacheControl(maxAge: 0)
//     likedCount: Int @cacheControl(maxAge: 0)