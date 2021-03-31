import { withEdgePagination } from '@apollosproject/server-core';

const resolver = {
  NodeConnection: {
    totalCount: ({ getTotalCount }) => getTotalCount(),
    pageInfo: withEdgePagination,
  },
};

export default resolver;
