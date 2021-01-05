import { featuresSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';

export default gql`
  extend type Query {
    connectFeedFeatures: [Feature] @cacheControl(maxAge: 0)
    eventsFeedFeatures: [Feature] @cacheControl(maxAge: 0)
    giveFeedFeatures: FeatureFeed @cacheControl(maxAge: 0)
    userHeaderFeatures: [Feature]
    @cacheControl(maxAge: 0)
    @deprecated(reason: "Please use homeHeaderFeatures instead")
    homeHeaderFeatures: FeatureFeed @cacheControl(maxAge: 0)
  }
`;
