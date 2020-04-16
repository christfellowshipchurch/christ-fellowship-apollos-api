import gql from 'graphql-tag'

export default gql`
  type AppLink {
    name: String!
    uri: String
    icon: String
    openInApp: Boolean
  }  

  type AppLinks {
    name: String!
    links: [AppLink]
  }

  extend type Query { 
    privacyPolicyUrl: String
    moreLinks: [AppLinks]
    profileLinks: [AppLink]
    websiteBanner: CallToAction
    genderOptions: [String]
  }
`