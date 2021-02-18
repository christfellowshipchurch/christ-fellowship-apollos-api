import ApollosConfig from '@apollosproject/config';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

const { ROCK_MAPPINGS } = ApollosConfig;
import { get } from 'lodash';

import { rockImageUrl } from '../utils';

function getTransformedCoverImage(item) {
  const coverImageGuid = get(item.attributeValues, 'image.value', null);

  if (coverImageGuid) {
    return rockImageUrl(
      coverImageGuid,
      {
        w: 768,
        format: 'jpg',
        quality: 70,
      }
    );
  }

  return null;
}

export default class GroupPreferences extends RockApolloDataSource {
  getGroupPreferences = async () => {
    const { DefinedValueList } = this.context.dataSources;
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
              uri: getTransformedCoverImage(item)
            },
          ],
        },
        url: get(item.attributeValues, 'url.value', null),
      };
    });
  };

  getGroupSubPreferences = async () => {
    const { DefinedValueList } = this.context.dataSources;
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
              uri: getTransformedCoverImage(item),
            },
          ],
        },
      };
    });
  };
}
