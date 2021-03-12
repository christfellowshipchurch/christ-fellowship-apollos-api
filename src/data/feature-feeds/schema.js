import gql from 'graphql-tag';

export default gql`
  extend type Query {
    connectFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)
    eventsFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)
    giveFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)
    homeHeaderFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)

    userHeaderFeatures: [Feature]
    @cacheControl(maxAge: 0)
    @deprecated(reason: "Please use homeHeaderFeedFeatures instead")
  }
`;
