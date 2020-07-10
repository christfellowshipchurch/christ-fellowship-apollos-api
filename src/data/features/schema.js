import { featuresSchema } from '@apollosproject/data-schema'
import gql from 'graphql-tag'

export default gql`
    ${featuresSchema}

    extend enum ACTION_FEATURE_ACTION {
        VIEW_CHILDREN
        READ_GLOBAL_CONTENT
    }

    type LiveStreamListFeature implements Feature & Node {
        id: ID!
        order: Int
        liveStreams: [LiveStream]
    }
    
    extend type Query {
        userHeaderFeatures: [Feature] @cacheControl(maxAge: 0)
    }
`