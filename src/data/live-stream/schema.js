import { liveSchema } from '@apollosproject/data-schema'
import gql from 'graphql-tag'

export default gql`
    ${liveSchema}

    extend type LiveStream {
        callsToAction: [CallToAction]
    }

    type FloatLeftLiveStream {
        start: String
        isLive: Boolean
        coverImage: ImageMedia
        media: VideoMedia
        title: String
    }

    extend type Query {
        floatLeftLiveStream: LiveStream
        floatLeftEmptyLiveStream: LiveStream
    }
`