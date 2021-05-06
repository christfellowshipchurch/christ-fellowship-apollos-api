import { featuresSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';

export default gql`
  ${featuresSchema}

  extend enum ACTION_FEATURE_ACTION {
    VIEW_CHILDREN
    READ_GLOBAL_CONTENT
    READ_PRAYER
    READ_GROUP
  }

  enum CONTENT_BLOCK_ORIENTATION {
    DEFAULT
    INVERTED
    LEFT
    RIGHT
  }

  enum HorizontalCardType {
    DEFAULT
    HIGHLIGHT
    HIGHLIGHT_MEDIUM
    HIGHLIGHT_SMALL
  }

  extend type HorizontalCardListFeature {
    cardType: HorizontalCardType
  }

  type LiveStreamAction {
    relatedNode: Node
    action: ACTION_FEATURE_ACTION
    title: String

    duration: Int
    image: String
    start: Int
  }

  extend type ActionBarAction {
    theme: Theme
  }

  type AvatarListFeature implements Feature & Node {
    id: ID!
    order: Int

    people: [Person]
    isCard: Boolean
    primaryAction: ActionBarAction
  }

  type LiveStreamListFeature implements Feature & Node {
    id: ID!
    order: Int
    title: String
    subtitle: String
    liveStreams: [LiveStream]
  }

  type CommentListFeature implements Feature & Node {
    id: ID!
    order: Int
  }

  type ContentBlockFeature implements Feature & Node {
    id: ID!
    order: Int

    title(hyphenated: Boolean): String
    subtitle: String

    htmlContent: String
    coverImage: ImageMedia
    videos: [VideoMedia]

    orientation: CONTENT_BLOCK_ORIENTATION
    actions: [FeatureAction]

    summary: String @deprecated(reason: "Please use 'subtitle' instead")
    callToAction: CallToAction @deprecated(reason: "Please use 'actions' instead")
    secondaryCallToAction: CallToAction @deprecated(reason: "Please use 'actions instead")
    imageRatio: String @deprecated(reason: "UI doesn't respect this field")
    imageAlt: String @deprecated(reason: "UI doesn't respect this field")
  }

  type HtmlBlockFeature implements Feature & Node {
    id: ID!
    order: Int

    title(hyphenated: Boolean): String
    htmlContent: String
  }
`;
