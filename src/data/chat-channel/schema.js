import gql from 'graphql-tag'

export default gql`
    type ChatChannel {
        name: String!
        channelID: String!
    }

    interface ChatChannelNode {
        chatChannel: ChatChannel
    }

    extend type LiveStream implements ChatChannelNode
`