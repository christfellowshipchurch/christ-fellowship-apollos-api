import { createGlobalId, withEdgePagination } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';
import moment from 'moment-timezone';

const { ROCK } = ApollosConfig;

const resolver = {
  Message: {
    id: ({ id }, args, context, { parentType }) => createGlobalId(id, parentType.name),
    title: ({ attributeValues }, args, context) =>
      get(attributeValues, 'title.value', ''),
    subtitle: ({ attributeValues }, args, context) =>
      get(attributeValues, 'subtitle.value', ''),
    body: ({ attributeValues }, args, context) => get(attributeValues, 'body.value', ''),
    date: ({ attributeValues }, args, context) =>
      moment.tz(get(attributeValues, 'date.value', ''), ROCK.TIMEZONE).utc().format(),
  },
  MessagesConnection: {
    totalCount: ({ getTotalCount }) => getTotalCount(),
    pageInfo: withEdgePagination,
  },
  Query: {
    notificationCenter: (root, args, { dataSources }) =>
      dataSources.Message.paginate({
        cursor: dataSources.Message.getByNotificationCenter(),
        args,
      }),
  },
};

export default resolver;
