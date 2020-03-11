import moreLinkJson from './moreTab.json'

const resolver = {
  Query: {
    privacyPolicyUrl: () => "https://beta.christfellowship.church/privacy-policy",
    moreLinks: () => moreLinkJson
  },
}

export default resolver
