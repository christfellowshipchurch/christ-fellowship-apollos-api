import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import { getIdentifierType } from '../utils';

export default class DefinedValueList extends RockApolloDataSource {
  resource = 'DefinedValues';
  expanded = true;

  getByIdentifier = async (id) => {
    const definedValues = await this.request().filter(`DefinedTypeId eq ${id}`).get();

    return { id, definedValues };
  };
}
