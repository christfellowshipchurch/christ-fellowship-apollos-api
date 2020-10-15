import ApollosConfig from "@apollosproject/config";
import { RESTDataSource } from 'apollo-datasource-rest'
import { createGlobalId } from "@apollosproject/server-core";
import { StreamChat as StreamChatClient } from "stream-chat";
import { get } from 'lodash';

const { STREAM } = ApollosConfig;
const { CHAT_SECRET, CHAT_API_KEY } = STREAM;

// Define singleton instance of StreamChatClient
let chatClient;

if (CHAT_SECRET && CHAT_API_KEY && !chatClient) {
  chatClient = new StreamChatClient(
    CHAT_API_KEY,
    CHAT_SECRET,
    { region: "us-east-1" }
  );
} else {
  console.warn(
    "You are using the Stream Chat dataSource without Stream credentials. To avoid issues, add Stream Chat credentials to your config.yml or remove the Stream Chat dataSource"
  );
}

function getStreamUserId(id) {
  const globalId = createGlobalId(id, "AuthenticatedUser");
  return globalId.split(":")[1];
}

export default class StreamChat extends RESTDataSource {
  generateUserToken = (userId) => {
    const streamUserId = getStreamUserId(userId);

    return chatClient.createToken(streamUserId);
  };

  currentUserIsLiveStreamModerator = async () => {
    const { Flag } = this.context.dataSources;
    const flagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT_MODERATOR');

    return flagStatus === 'LIVE';
  }

  addModerator = async ({ channelId, userId, channelType = 'livestream' }) => {
    const streamUserId = getStreamUserId(userId);

    const channel = chatClient.channel(channelType, channelId);
    await channel.addModerators([streamUserId]);
  }

  removeModerator = async ({ channelId, userId, channelType = 'livestream' }) => {
    const streamUserId = getStreamUserId(userId);

    const channel = chatClient.channel(channelType, channelId);
    await channel.demoteModerators([streamUserId]);
  }
}
