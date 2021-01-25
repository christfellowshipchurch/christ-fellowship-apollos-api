import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import { getIdentifierType } from '../utils';

export default class DefinedValue extends RockApolloDataSource {
  resource = 'DefinedValues';
  expanded = true;

  getFromId = (id) => {
    const { Cache } = this.context.dataSources;
    const request = () => {
      const type = getIdentifierType(id);
      return type.query ? this.request().filter(type.query).first() : null;
    };

    return Cache.request(request, {
      expiresIn: 60 * 60, // 1 hour cache
      key: Cache.KEY_TEMPLATES.definedValue`${id}`,
    });
  };

  // ! Deprecated : please use getFromId instead
  getDefinedValueByIdentifier = this.getFromId;
  getByIdentifier = this.getFromId;

  getValueById = async (id) => {
    if (id && id !== '') {
      try {
        const definedValue = await this.getFromId(id);

        return definedValue.value;
      } catch (e) {
        console.log(`Error requesting Defined Value of Id: ${id}`, { e });
      }
    }

    return null;
  };
}
