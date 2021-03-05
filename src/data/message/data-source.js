import ApollosConfig from '@apollosproject/config';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

const { ROCK_MAPPINGS } = ApollosConfig;

const DEFINED_TYPE_ID = ROCK_MAPPINGS.DEFINED_TYPES.NOTIFICATION_CENTER;

export default class Message extends RockApolloDataSource {
  expanded = true;

  getFromId(id) {
    return this.request('DefinedValues')
      .filter(`Id eq ${id}`)
      .andFilter(`DefinedTypeId eq ${DEFINED_TYPE_ID}`)
      .andFilter(`IsActive eq true`)
      .first();
  }

  getByNotificationCenter() {
    return this.request('DefinedValues')
      .andFilter(`DefinedTypeId eq ${DEFINED_TYPE_ID}`)
      .andFilter(`IsActive eq true`)
      .orderBy('Order');
  }
}
