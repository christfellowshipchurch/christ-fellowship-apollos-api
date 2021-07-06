import ApollosConfig from '@apollosproject/config';
import { RESTDataSource } from 'apollo-datasource-rest';
import { createGlobalId, parseGlobalId } from '@apollosproject/server-core';
import { StreamChat as StreamChatClient } from 'stream-chat';
import { chunk, get, isEmpty } from 'lodash';
import { Utils } from '@apollosproject/data-connector-rock';

const { STREAM } = ApollosConfig;
const { CHAT_SECRET, CHAT_API_KEY } = STREAM;

// Define singleton instance of StreamChatClient
let chatClient;

if (CHAT_SECRET && CHAT_API_KEY && !chatClient) {
  chatClient = new StreamChatClient(CHAT_API_KEY, CHAT_SECRET, {
    region: 'us-east-1',
  });
} else {
  console.warn(
    'You are using the Stream Chat dataSource without Stream credentials. To avoid issues, add Stream Chat credentials to your config.yml or remove the Stream Chat dataSource'
  );
}

const CREATE_USERS_LIMIT = 100;
const QUERY_MEMBERS_LIMIT = 100;
const ADD_MEMBERS_LIMIT = 100;
const REMOVE_MEMBERS_LIMIT = 100;
const PROMOTE_MODERATORS_LIMIT = 100;
const DEMOTE_MODERATORS_LIMIT = 100;

export default class StreamChat extends RESTDataSource {
  channelType = {
    LIVESTREAM: 'livestream',
    MESSAGING: 'messaging',
    GROUP: 'group',
  };

  getFromId = (id) => {
    const { channelId, channelType } = JSON.parse(id);

    return {
      channelId,
      channelType,
    };
  };

  getStreamUserId(id) {
    const globalId = createGlobalId(id, 'AuthenticatedUser');
    return globalId.split(':')[1];
  }

  generateUserToken = (userId) => {
    // get or create user
    // return valid user token

    const streamUserId = this.getStreamUserId(userId);

    return chatClient.createToken(streamUserId);
  };

  currentUserIsLiveStreamModerator = async () => {
    const { Flag } = this.context.dataSources;
    const flagStatus = await Flag.currentUserCanUseFeature('LIVE_STREAM_CHAT_MODERATOR');

    return flagStatus === 'LIVE';
  };

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
    };
  };

  createStreamUsers = async ({ users }) => {
    let offset = 0;

    // Paginate through users according to Stream's max call limit
    do {
      const endIndex = offset + CREATE_USERS_LIMIT;
      const usersSubset = users.slice(offset, endIndex);

      await chatClient.upsertUsers(usersSubset);

      offset += CREATE_USERS_LIMIT;
    } while (users.length > offset);
  };

  getChannel = async ({ channelId, channelType, options = {} }) => {
    let channel;
    const query = await chatClient.queryChannels(
      { type: channelType, id: channelId },
      { last_updated: -1 },
      {
        watch: false,
        state: true,
        limit: 1,
      }
    );

    // Does the channel already exist?
    if (query.length) {
      channel = chatClient.channel(channelType, channelId);
    } else {
      // We need to create it. Stream requires a `created_by` option when creating channels server side.
      if (!options.created_by) {
        throw new Error(
          'getChannel requires an `options.created_by` user object when creating channels that do not exist.'
        );
      }

      channel = chatClient.channel(channelType, channelId, options);
      await channel.create();
    }

    return channel;
  };

  getChannelMembers = async ({ channelId, channelType, filter = {} }) => {
    const channel = chatClient.channel(channelType, channelId);

    const channelMembers = [];
    let responseMembers;

    // Continuously get members until we've reached a page that isn't 100% full (i.e. the end).
    do {
      const channelMembersResponse = await channel.queryMembers(
        filter,
        {},
        { limit: QUERY_MEMBERS_LIMIT, offset: channelMembers.length }
      );
      responseMembers = channelMembersResponse.members;
      channelMembers.push(...responseMembers);
    } while (responseMembers.length === QUERY_MEMBERS_LIMIT);

    return channelMembers;
  };

  addMembers = async ({
    channelId,
    groupMembers,
    channelType = this.channelType.LIVESTREAM,
  }) => {
    const channel = chatClient.channel(channelType, channelId);
    const channelMembers = await this.getChannelMembers({
      channelId,
      channelType,
    });
    const channelMemberIds = channelMembers.map((channelMember) =>
      get(channelMember, 'user.id')
    );

    const newMembers = groupMembers.filter(
      (member) => !channelMemberIds.includes(member)
    );

    if (newMembers.length) {
      // Array of promises, each promise being 1 operation to add many members.
      await Promise.all(
        chunk(newMembers, ADD_MEMBERS_LIMIT).map(async (chunkedMembers) => {
          await channel.addMembers(chunkedMembers);
        })
      );
    }
  };

  removeMembers = async ({
    channelId,
    groupMembers,
    channelType = this.channelType.LIVESTREAM,
  }) => {
    const channel = chatClient.channel(channelType, channelId);
    const channelMembers = await this.getChannelMembers({
      channelId,
      channelType,
    });
    const channelMemberIds = channelMembers.map((channelMember) =>
      get(channelMember, 'user.id')
    );

    const badMembers = channelMemberIds.filter(
      (channelMember) => !groupMembers.includes(channelMember)
    );

    if (badMembers.length) {
      // Array of promises, each promise being 1 operation to remove many members.
      await Promise.all(
        chunk(badMembers, REMOVE_MEMBERS_LIMIT).map(async (chunkedMembers) => {
          await channel.removeMembers(chunkedMembers);
        })
      );
    }
  };

  // Compare the group leaders to the channel moderators
  // Promote any member who is a group leader, but not a channel moderator
  // Demote any member who is a channel moderator, but not a group leader
  updateModerators = async ({
    channelId,
    groupLeaders,
    channelType = this.channelType.LIVESTREAM,
  }) => {
    const channel = chatClient.channel(channelType, channelId);
    const channelModerators = await this.getChannelMembers({
      channelId,
      channelType,
      filter: { is_moderator: true },
    });
    const channelModeratorIds = channelModerators.map((channelModerator) =>
      get(channelModerator, 'user.id')
    );

    // Promote any groupLeaders not in the channelModerators list
    const newModerators = groupLeaders.filter(
      (leader) => !channelModeratorIds.includes(leader)
    );

    if (newModerators.length) {
      // Array of promises, each promise being 1 operation to promote many members.
      await Promise.all(
        chunk(newModerators, PROMOTE_MODERATORS_LIMIT).map(async (chunkedModerators) => {
          await channel.addModerators(chunkedModerators);
        })
      );
    }

    // Demote any moderators not in the groupLeaders list
    const badModerators = channelModeratorIds.filter(
      (channelModerator) => !groupLeaders.includes(channelModerator)
    );

    if (badModerators.length) {
      // Array of promises, each promise being 1 operation to demote many members.
      await Promise.all(
        chunk(badModerators, DEMOTE_MODERATORS_LIMIT).map(async (chunkedModerators) => {
          await channel.demoteModerators(chunkedModerators);
        })
      );
    }
  };

  addModerator = async ({
    channelId,
    userId,
    channelType = this.channelType.LIVESTREAM,
  }) => {
    const streamUserId = this.getStreamUserId(userId);

    const channel = chatClient.channel(channelType, channelId);
    await channel.addModerators([streamUserId]);
  };

  removeModerator = async ({
    channelId,
    userId,
    channelType = this.channelType.LIVESTREAM,
  }) => {
    const streamUserId = this.getStreamUserId(userId);

    const channel = chatClient.channel(channelType, channelId);
    await channel.demoteModerators([streamUserId]);
  };

  handleNewMessage = async (data) => {
    const { Flag, OneSignal, Person } = this.context.dataSources;

    const sender = get(data, 'user', {});
    const channelId = get(data, 'channel_id');
    const channelType = get(data, 'channel_type');
    const content = get(data, 'message.text', '');
    const members = get(data, 'members', []);
    const memberIds = members
      .filter(({ user }) => !user.banned) // user isn't banned
      .filter(({ banned }) => !banned) // user isn't banned from the channel
      .filter(({ user }) => !user.shadow_banned) // user isn't shadow banned from the channel
      .map(({ user_id }) => user_id)
      .filter((id) => id !== sender.id);

    if (channelId && channelType) {
      const channel = await this.getChannel({ channelId, channelType });
      const channelName = get(channel, 'data.name', null);
      const mutedNotifications = get(channel, 'data.muteNotifications', []);
      const mutedUsers =
        mutedNotifications && Array.isArray(mutedNotifications) ? mutedNotifications : [];

      const rockAliasIds = await Promise.all(
        memberIds
          .filter((id) => !mutedUsers.includes(id)) // user who doesn't have notifications disabled for this channel
          .map(async (id) => {
            const { id: rockPersonId } = parseGlobalId(`Person:${id}`);
            const person = await Person.getFromId(rockPersonId);
            return get(person, 'primaryAliasId');
          })
      );

      if (rockAliasIds.length) {
        return;
        const basePayload = {
          toUserIds: rockAliasIds
            .filter((id) => !!id) // filter out invalid ids as a last check
            .map((id) => `${id}`), // OneSignal expects an array of string Ids
          content,
          heading: `💬 Message from ${sender.name}`,
          ...(isEmpty(channelName) ? {} : { subtitle: channelName }),
          app_url: `christfellowship://c/ChatChannelSingle?streamChannelId=${channelId}&streamChannelType=${channelType}`,
        };

        /**
         * ! Backwards compatibility requirements
         * 6.0.2 or earlier : do not auto-increment the Notification Badges as there is no way for the client-side applications to clear those badges
         * 6.0.3 or later : auto-incrememnt the Notification Badges
         */

        // note : 6.0.2 or earlier
        OneSignal.createNotification({
          ...basePayload,
          filters: [{ field: 'app_version', relation: '<', value: '6.0.3' }],
        });

        // note : 6.0.3 or later
        OneSignal.createNotification({
          ...basePayload,
          ios_badgeType: 'Increase',
          filters: [{ field: 'app_version', relation: '>', value: '6.0.2' }],
        });
      }
    }
  };
}
