import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

import { getIdentifierType } from '../utils';

export default class MatrixItem extends RockApolloDataSource {
  expanded = true;

  getItemsFromId = async (id) => {
    const { Cache } = this.context.dataSources;
    const request = () =>
      this.request('/AttributeMatrixItems')
        .filter(`AttributeMatrix/${getIdentifierType(id).query}`)
        .orderBy('Order')
        .transform((results) => {
          if (results) {
            Cache.set({
              key: cachedKey,
              data: results,
            });
          }

          return results;
        })
        .get();

    return id
      ? Cache.request(request, {
          key: Cache.KEY_TEMPLATES.attributeMatrix`${id}`,
          expiresIn: 60 * 60, // 1 hour cache
        })
      : [];
  };
}
