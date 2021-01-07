import { featuresSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';

export default gql`
  extend type Query {
    eventsFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)
    giveFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)
    homeHeaderFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)

    connectFeedFeatures: [Feature] @cacheControl(maxAge: 0)

    userHeaderFeatures: [Feature]
    @cacheControl(maxAge: 0)
    @deprecated(reason: "Please use homeHeaderFeedFeatures instead")
  }
`;
