import ApollosConfig from "@apollosproject/config";
import { RESTDataSource } from 'apollo-datasource-rest'
import { createGlobalId } from "@apollosproject/server-core";
import { StreamChat as StreamChatClient } from "stream-chat";
import { chunk, get } from 'lodash';
import {  Utils } from '@apollosproject/data-connector-rock'

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

const CREATE_USERS_LIMIT = 100;
const QUERY_MEMBERS_LIMIT = 100;
const ADD_MEMBERS_LIMIT = 100;
const REMOVE_MEMBERS_LIMIT = 100;

export default class StreamChat extends RESTDataSource {
  getStreamUserId(id) {
    const globalId = createGlobalId(id, "AuthenticatedUser");
    return globalId.split(":")[1];
  };

  generateUserToken = (userId) => {
    const streamUserId = this.getStreamUserId(userId);

    return chatClient.createToken(streamUserId);
  };

  currentUserIsLiveStreamModerator = async () => {
    const { Flag } = this.context.dataSources;
    const flagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT_MODERATOR');

    return flagStatus === 'LIVE';
  }

  getChannel = ({ channelId, channelType = 'livestream'}) => {
    return chatClient.channel(channelType, channelId);
  }

  getStreamUser = (user) => {
    const imageId = get(user, 'photo.guid', '');
    let image = '';
    if (imageId) {
      image = Utils.createImageUrlFromGuid(imageId);
    }
    return {
      id: this.getStreamUserId(user.id),
      name: `${user.firstName} ${user.lastName}`,
      image,
    }
  };

  createStreamUsers = async ({ users }) => {
    await Promise.all(chunk(users, CREATE_USERS_LIMIT).map(async (chunkedUsers) => {
      await chatClient.updateUsers(chunkedUsers);
    }));
  }

  getChannel = async({ channelId, channelType, options }) => {
    const channel = chatClient.channel(channelType, channelId, options);
    return channel.create();
  }

  getChannelMembers = async({ channelId, channelType }) => {
    const channel = chatClient.channel(channelType, channelId);

    const channelMembers = [];
    let responseMembers;
    do {
      const channelMembersResponse = await channel.queryMembers({}, {}, { limit: QUERY_MEMBERS_LIMIT, offset: channelMembers.length });
      responseMembers = channelMembersResponse.members;
      channelMembers.push(...responseMembers);
    } while (responseMembers.length === QUERY_MEMBERS_LIMIT);

    return channelMembers;
  }

  addMembers = async({ channelId, groupMembers, channelType = 'livestream' }) => {
    const channel = chatClient.channel(channelType, channelId);
    const channelMembers = await this.getChannelMembers({ channelId, channelType });
    const channelMemberIds = channelMembers.map(channelMember => get(channelMember, 'user.id'));

    const newMembers = groupMembers.filter(member => !channelMemberIds.includes(member));

    if (newMembers.length) {
      await Promise.all(chunk(newMembers, ADD_MEMBERS_LIMIT).map(async (chunkedMembers) => {
        await channel.addMembers(chunkedMembers);
      }));
    }
  }

  removeMembers = async({ channelId, groupMembers, channelType = 'livestream' }) => {
    const channel = chatClient.channel(channelType, channelId);
    const channelMembers = await this.getChannelMembers({ channelId, channelType });
    const channelMemberIds = channelMembers.map(channelMember => get(channelMember, 'user.id'));

    const badMembers = channelMemberIds.filter(channelMember => !groupMembers.includes(channelMember));

    if (badMembers.length) {
      await Promise.all(chunk(badMembers, REMOVE_MEMBERS_LIMIT).map(async (chunkedMembers) => {
        await channel.removeMembers(chunkedMembers);
      }));
    }
  }

  addModerator = async ({ channelId, userId, channelType = 'livestream' }) => {
    const streamUserId = this.getStreamUserId(userId);

    const channel = chatClient.channel(channelType, channelId);
    await channel.addModerators([streamUserId]);
  }

  removeModerator = async ({ channelId, userId, channelType = 'livestream' }) => {
    const streamUserId = this.getStreamUserId(userId);

    const channel = chatClient.channel(channelType, channelId);
    await channel.demoteModerators([streamUserId]);
  }
}
