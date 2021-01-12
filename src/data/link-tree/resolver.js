import { get } from 'lodash';

const resolver = {
  Query: {
    linkTree: (root, args, { dataSources }) => dataSources.LinkTree.getLinks(),
  },
};

export default resolver;
