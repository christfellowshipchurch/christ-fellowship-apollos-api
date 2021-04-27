import { Persona as corePersona } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';

export default class Persona extends corePersona.dataSource {
  constructor(options) {
    super(options);
  }

  getPersonas = async ({ categoryId }) => {
    const { Auth, Cache, RockConstants } = this.context.dataSources;

    // Get current user
    const { id } = await Auth.getCurrentPerson();

    const request = async () => {
      // Get the entity type ID of the Person model
      const personEntityTypeId = await RockConstants.modelType('Person');

      // Rely on custom code without the plugin.
      // Use plugin, if the user has set USE_PLUGIN to true.
      // In general, you should ALWAYS use the plugin if possible.
      const endpoint = get(ApollosConfig, 'ROCK.USE_PLUGIN', false)
        ? 'Apollos/GetPersistedDataViewsForEntity'
        : 'DataViews/GetPersistedDataViewsForEntity';

      // Return a list of all dataviews by GUID a user is a memeber
      return this.request(endpoint)
        .find(`${personEntityTypeId.id}/${id}?categoryId=${categoryId}`)
        .select('Guid')
        .get();
    };

    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.personas`${id}`,
      duration: 10, // 10 minute
    });
  };
}
