import ApollosConfig from "@apollosproject/config";
import { RESTDataSource } from 'apollo-datasource-rest'
import { createGlobalId } from "@apollosproject/server-core";
import { StreamChat as StreamChatClient } from "stream-chat";

const { STREAM } = ApollosConfig;
const { CHAT_SECRET, CHAT_API_KEY, CHAT_APP_ID } = STREAM;

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

export default class StreamChat extends RESTDataSource {
  generateUserToken = (id) => {
    const globalId = createGlobalId(id, "AuthenticatedUser");
    const userId = globalId.split(":")[1];

    return chatClient.createToken(userId);
  };

  addModerator = async (id) => {
    const globalId = createGlobalId(id, "AuthenticatedUser");
    const userId = globalId.split(":")[1];

    await chatClient.updateUser({
      id: userId,
      // role: 'moderator', 
      role: 'admin', 
    });
  }
}
