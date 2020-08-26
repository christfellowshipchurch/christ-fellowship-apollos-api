import ApollosConfig from "@apollosproject/config";
import { RESTDataSource } from 'apollo-datasource-rest'
import { createGlobalId } from "@apollosproject/server-core";
import { StreamChat as StreamChatClient } from "stream-chat";

const { STREAM } = ApollosConfig;
const { CHAT_SECRET, CHAT_API_KEY, CHAT_APP_ID } = STREAM;

// Define singleton instance of StreamChatClient
let chatClient;

if (CHAT_SECRET && CHAT_API_KEY) {
  chatClient = new StreamChatClient(
    CHAT_API_KEY,
    CHAT_SECRET,
    { region: "us-east-1" }
  );
  console.log('[rkd] ✅ Created chat client');
} else {
  console.warn(
    "You are using the Stream Chat dataSource without Stream credentials. To avoid issues, add Stream Chat credentials to your config.yml or remove the Stream Chat dataSource"
  );
}

export default class StreamChat extends RESTDataSource {
  generateUserToken = async (currentPerson) => {
    const globalId = createGlobalId(currentPerson.id, "AuthenticatedUser"); // -> "AuthenticatedUser:abc123de56789f"
    const userId = globalId.split(":")[1];

    console.log('[rkd] creating token for userId:', userId);
    const token = await chatClient.createToken(userId);
    console.log('[rkd] token:', token);

    return token;
  };
}
