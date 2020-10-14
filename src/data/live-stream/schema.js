import { liveSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';

export default gql`
  ${liveSchema}

  extend type LiveStream {
    chatChannelId: String
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

  extend enum InteractionAction {
    LIVESTREAM_JOINED
    LIVESTREAM_CLOSED
  }
`;
