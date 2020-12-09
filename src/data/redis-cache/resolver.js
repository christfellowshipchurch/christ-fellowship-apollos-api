import { get } from 'lodash';
import { Utils } from '@apollosproject/data-connector-rock';
const { createImageUrlFromGuid } = Utils;
import { parseRockKeyValuePairs } from '../utils';

export default {
  Mutation: {
    flush: (root, { url }, { dataSources: { Cache } }) => Cache.request(),
  },
};
