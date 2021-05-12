import ApollosConfig from '@apollosproject/config';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

const { ROCK_MAPPINGS } = ApollosConfig;
import { get } from 'lodash';

import { rockImageUrl } from '../utils';

export default class GroupPreference extends RockApolloDataSource {
  getFromId = (id) => {
    const { DefinedValue } = this.context.dataSources;

    return DefinedValue.getFromId(id);
  };

  getGroupPreferences = async () => {
    const { DefinedValueList } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getByIdentifier(
      ROCK_MAPPINGS.DEFINED_TYPES.GROUP_PREFERENCES
    );

    const filteredPreferences = definedValues.filter(
      (definedValue) => definedValue && definedValue.isActive
    );

    console.log('HELLO');

    return filteredPreferences;
  };

  getGroupSubPreferences = async () => {
    const { DefinedValueList } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getByIdentifier(
      ROCK_MAPPINGS.DEFINED_TYPES.GROUP_SUB_PREFERENCES
    );

    const filteredSubPreferences = definedValues.filter(
      (definedValue) => definedValue && definedValue.isActive
    );

    return filteredSubPreferences;
  };
}
