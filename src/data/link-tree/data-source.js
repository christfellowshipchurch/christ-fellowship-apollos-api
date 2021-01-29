import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';

const { ROCK_MAPPINGS } = ApollosConfig;
const { DEFINED_TYPES } = ROCK_MAPPINGS;

export default class DefinedValueList extends RockApolloDataSource {
  resource = 'DefinedValues';
  expanded = true;

  getLinks = async () => {
    const { Cache } = this.context.dataSources;
    const request = () =>
      this.request()
        .filter(`DefinedTypeId eq ${DEFINED_TYPES.LINK_TREE}`)
        .andFilter('IsActive eq true')
        .orderBy('Order')
        .get();
    const definedValues = await Cache.request(request, {
      key: Cache.KEY_TEMPLATES.linkTree,
      expiresIn: 60 * 20, // 20 minute cache
    });

    return definedValues
      .filter(
        (definedValue) =>
          !!get(definedValue, 'attributeValues.url.value') &&
          get(definedValue, 'attributeValues.url.value') !== ''
      )
      .map((definedValue) => {
        const { value, attributeValues } = definedValue;
        const url = get(attributeValues, 'url.value');

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
