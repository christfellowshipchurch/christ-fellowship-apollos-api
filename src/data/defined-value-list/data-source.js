import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

export default class DefinedValueList extends RockApolloDataSource {
  resource = 'DefinedValues';

  expanded = true;

  getFromId = async (id) => {
    // TODO : cache this
    const { Cache } = this.context.dataSources;
    const request = () =>
      this.request()
        .orderBy('Order')
        .filter(`DefinedTypeId eq ${id}`)
        .andFilter(`IsActive eq true`)
        .transform((definedValues) => ({ id, definedValues }))
        .get();

    return Cache.request(request, {
      expiresIn: 60 * 60 * 12,
      key: Cache.KEY_TEMPLATES.definedType`${id}`,
    });
  };

  getByIdentifier = this.getFromId;
}
