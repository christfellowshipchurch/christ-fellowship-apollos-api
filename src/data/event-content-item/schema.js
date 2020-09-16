import gql from 'graphql-tag'

export default gql`
  type EventInstanceCategory {
    name: String
    instances: [Event]
  }

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

    nextOccurrence: String @deprecated(reason: "Previously used to create a label on the client. Please use 'label' instead")
    startDate: String @deprecated(reason: "Previously used to create a label on the client. Please use 'label' instead")
    endDate: String @deprecated(reason: "Previously used to create a label on the client. Please use 'label' instead")

    tags: [String]
    callsToAction: [CallToAction] @deprecated(reason: "Updating to use FeatureAction to better adhere to navigation standards. Please use 'actions' instead.")
    openLinksInNewTab: Boolean @deprecated(reason: "Label will now be explicitly defined on the API")
    hideLabel: Boolean @deprecated(reason: "Label will now be explicitly defined on the API")

    events: [Event] @deprecated(reason: "We have updated the organization of the events schema. Please use 'categories' instead.")

    label: String
    categories: [EventInstanceCategories]
  }
`


// sharing: SharableContentItem
//     isLiked: Boolean @cacheControl(maxAge: 0)
//     likedCount: Int @cacheControl(maxAge: 0)