import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';

const { ROCK_MAPPINGS } = ApollosConfig;
const { DEFINED_TYPES } = ROCK_MAPPINGS;

export default class DefinedValueList extends RockApolloDataSource {
  resource = 'DefinedValues';
  expanded = true;

  getLinks = async () => {
    const definedValues = await this.request()
      .filter(`DefinedTypeId eq ${DEFINED_TYPES.LINK_TREE}`)
      .andFilter('IsActive eq true')
      .orderBy('Order')
      .get();

    console.log({ definedValues });

    return definedValues
      .filter(
        (definedValue) =>
          !!get(definedValue, 'attributeValues.url.value') &&
          get(definedValue, 'attributeValues.url.value') !== ''
      )
      .map((definedValue) => {
        const { value, attributeValues } = definedValue;
        const url = get(attributeValues, '');

        return {
          title: value,
          action: 'OPEN_URL',
          relatedNode: {
            __typename: 'Url',
            url,
          },
        };
      });
  };
}
