import gql from 'graphql-tag';

export default gql`
  type StreamChatChannel implements Node {
    id: ID!
    channelId: String
    channelType: String
  }

  enum StreamChatChannelType {
    LIVESTREAM
    MESSAGING
    GROUP
  }

  interface StreamChatChannelNode {
    streamChatChannel: StreamChatChannel
  }

  extend type LiveStream implements StreamChatChannelNode {
    streamChatChannel: StreamChatChannel
  }

  extend type Group implements StreamChatChannelNode {
    streamChatChannel: StreamChatChannel
  }

  extend type VolunteerGroup implements StreamChatChannelNode {
    streamChatChannel: StreamChatChannel
  }
`;
