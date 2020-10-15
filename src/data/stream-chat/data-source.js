import ApollosConfig from "@apollosproject/config";
import { RESTDataSource } from 'apollo-datasource-rest'
import { createGlobalId } from "@apollosproject/server-core";
import { StreamChat as StreamChatClient } from "stream-chat";
import { get } from 'lodash';

const { STREAM, FEATURE_FLAGS } = ApollosConfig;
const { CHAT_SECRET, CHAT_API_KEY } = STREAM;
const MODERATOR_GROUP_ID = get(FEATURE_FLAGS, 'LIVE_STREAM_CHAT.moderatorGroupId', -1);

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

  currentUserIsGlobalModerator = async () => {
    const { Auth } = this.context.dataSources;

    if (await Auth.isInSecurityGroup(MODERATOR_GROUP_ID)) {
      return true;
    }

    return false;
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
