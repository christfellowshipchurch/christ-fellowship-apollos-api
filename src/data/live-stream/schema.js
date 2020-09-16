import gql from 'graphql-tag'

/**
 * Copies the LiveStream schema from @apollos/data-schema-1.5.0
 */
export default gql`
    # TODO : move this to its own directory when it's production ready
    type ChatChannel {
        name: String!
        channelID: String!
        
        # maybe..? might be unecessary but thought I would throw it in there
        members: [Person]
    }

    interface ChatChannelNode {
        chatChannel: ChatChannel
    }

    extend type LiveStream implements ChatChannelNode

    interface LiveNode {
        liveStream: LiveStream
    }

    extend EventContentItem implements LiveNode
    #

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

    extend type WeekendContentItem {
        liveStream: LiveStream
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

        liveStream: LiveStream
            @deprecated(reason: "Use liveStreams, there may be multiple.")
        liveStreams: [LiveStream] @cacheControl(maxAge: 10)
    }
`