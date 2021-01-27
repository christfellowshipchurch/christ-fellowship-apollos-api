import ApollosConfig from '@apollosproject/config';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

const { ROCK_MAPPINGS } = ApollosConfig;
import { Utils } from '@apollosproject/data-connector-rock';
import { get } from 'lodash';

const { createImageUrlFromGuid } = Utils;

export default class Preferences extends RockApolloDataSource {
  getPreferences = async () => {
    const { DefinedValueList, ContentItem } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getByIdentifier(
      ROCK_MAPPINGS.DEFINED_TYPES.GROUP_PREFERENCES
    );

    const filteredPreferences = definedValues.filter(
      (definedValue) => definedValue && definedValue.isActive
    );

    return filteredPreferences.map((item) => {
      return {
        id: item.id,
        title: get(item.attributeValues, 'titleOverride.value', null)
          ? item.attributeValues.titleOverride.value
          : item.value,
        summary: item.description,
        coverImage: {
          sources: [
            {
              uri: get(item.attributeValues, 'image.value', null)
                ? createImageUrlFromGuid(item.attributeValues.image.value)
                : null,
            },
          ],
        },
        url: get(item.attributeValues, 'url.value', null),
      };
    });

    return definedValues;
  };
  getSubPreferences = async () => {
    const { DefinedValueList, ContentItem } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getByIdentifier(
      ROCK_MAPPINGS.DEFINED_TYPES.GROUP_SUB_PREFERENCES
    );

    const filteredSubPreferences = definedValues.filter(
      (definedValue) => definedValue && definedValue.isActive
    );

    return filteredSubPreferences.map((item) => {
      return {
        id: item.id,
        title: item.value,
        coverImage: {
          sources: [
            {
              uri: get(item.attributeValues, 'image.value', null)
                ? createImageUrlFromGuid(item.attributeValues.image.value)
                : null,
            },
          ],
        },
      };
    });

    return definedValues;
  };
}
