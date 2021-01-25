import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import { getIdentifierType } from '../utils';

export default class DefinedValue extends RockApolloDataSource {
  resource = 'DefinedValues';
  expanded = true;

  getFromId = async (id) => {
    const { Cache } = this.context.dataSources;
    const { type } = getIdentifierType(id);
    let _id = id;

    if (type === 'guid') {
      _id = await this.getIdFromGuid(id);
    }

    if (_id) {
      return Cache.request(() => this.request().find(_id).get(), {
        expiresIn: 60 * 60, // 1 hour cache
        key: Cache.KEY_TEMPLATES.definedValue`${id}`,
      });
    }

    return null;
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

  getIdFromGuid = async (guid) => {
    const { Cache } = this.context.dataSources;
    const { query } = getIdentifierType(guid);

    return Cache.request(
      () =>
        this.request()
          .filter(query)
          .transform((results) => results[0]?.id)
          .get(),
      {
        key: Cache.KEY_TEMPLATES.definedValueGuidId`${guid}`,
        expiresIn: 60 * 60 * 24, // 24 hour cache
      }
    );
  };
}
