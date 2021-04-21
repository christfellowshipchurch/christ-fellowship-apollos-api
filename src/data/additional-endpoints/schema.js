import gql from 'graphql-tag';

export default gql`
  type AppLink {
    name: String!
    uri: String
    icon: String
    openInApp: Boolean
    theme: Theme
  }

  type AppLinks {
    name: String!
    links: [AppLink]
  }

  extend type Query {
    privacyPolicyUrl: String
    passwordResetUrl: String
    moreLinks: [AppLinks]
    profileLinks: [AppLink]
    websiteBanner: CallToAction
    genderOptions: [String]
    inAppLink(url: String!): String
    dannysContent: [ContentItem]
    getNodeByPathname(pathname: String): Node
  }

  extend type MediaContentItem implements FeaturesNode {
    features: [Feature] @deprecated(reason: "Use featureFeed")
    featureFeed: FeatureFeed
  }
`;
