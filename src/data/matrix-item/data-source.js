import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

import { getIdentifierType } from '../utils'

export default class MatrixItem extends RockApolloDataSource {
    expanded = true;

    getItemsFromId = async (id) =>
        id
            ? this.request('/AttributeMatrixItems')
                .filter(`AttributeMatrix/${getIdentifierType(id).query}`)
                .orderBy("Order")
                .get()
            : [];
}