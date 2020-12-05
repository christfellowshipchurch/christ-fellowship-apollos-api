import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

import { getIdentifierType } from '../utils';

export default class MatrixItem extends RockApolloDataSource {
  expanded = true;

  getItemsFromId = async (id) => {
    const { Cache } = this.context.dataSources;
    const cachedKey = `attribute_matrix_${id}`;
    const cachedValue = await Cache.get({
      key: cachedKey,
    });

    if (cachedValue) {
      return cachedValue;
    }

    return id
      ? this.request('/AttributeMatrixItems')
          .filter(`AttributeMatrix/${getIdentifierType(id).query}`)
          .orderBy('Order')
          .transform((results) => {
            if (results) {
              Cache.set({
                key: cachedKey,
                data: results,
                expiresIn: 60 * 60, // 1 hour cache
              });
            }

            return results;
          })
          .get()
      : [];
  };
}
