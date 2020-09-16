import { liveSchema } from '@apollosproject/data-schema'
import gql from 'graphql-tag'

export default gql`
    type LiveStream {
        isLive: Boolean @cacheControl(maxAge: 10)
        eventStartTime: String
        media: VideoMedia
        webViewUrl: String
        contentItem: ContentItem @cacheControl(maxAge: 10)

        chatChannelId: String
    }    

    ${liveSchema}

    type LiveStream implements Node {
        id: ID!
        isLive: Boolean @cacheControl(maxAge: 10)
        eventStartTime: String
        eventEndTime: String
        media: VideoMedia
        webViewUrl: String
        contentItem: ContentItem @cacheControl(maxAge: 10) @deprecated(reason: "LiveStreams are not limited to ContentItems. Please use 'relatedNode' instead.")

        relatedNode: Node
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