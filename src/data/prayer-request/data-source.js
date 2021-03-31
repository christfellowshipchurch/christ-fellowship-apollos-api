import { PrayerRequest as corePrayerRequest } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { isRequired } from '../utils';

const { ROCK_MAPPINGS } = ApollosConfig;

export default class PrayerRequest extends corePrayerRequest.dataSource {
  baseByDailyPrayerFeed = this.byDailyPrayerFeed;
  baseAddPrayer = this.addPrayer;

  getFromId = (id) => {
    const { Cache } = this.context.dataSources;
    const request = () => this.request().find(id).get();

    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.prayerRequest`${id}`,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });
  };

  addPrayer = async (args) => {
    const { Cache, Auth } = this.context.dataSources;
    const { id } = await Auth.getCurrentPerson();

    const prayerSubmission = await this.baseAddPrayer(args);

    Cache.delete(
      {
        key: Cache.KEY_TEMPLATES.personPrayers`${id}`,
      },
      () => this.getIdsByPerson(id)
    );

    return prayerSubmission;
  };

  byDailyPrayerFeed = async (props) => {
    const requestBuilder = await this.baseByDailyPrayerFeed(props);

    return requestBuilder.andFilter(
      `CategoryId eq ${ROCK_MAPPINGS.GENERAL_PRAYER_CATEGORY_ID}`
    );
  };

  async getIdsByPerson(id = isRequired('byPerson', 'id')) {
    const { Cache, Person } = this.context.dataSources;
    const { primaryAliasId } = await Person.getFromId(id);
    const request = () =>
      this.request()
        .filter(`RequestedByPersonAliasId eq ${primaryAliasId}`) // only show your own prayers
        .andFilter(`IsActive eq true`) // prayers can be marked as "in-active" in Rock
        .andFilter(`IsApproved eq true`) // prayers can be moderated in Rock
        .andFilter('IsPublic eq true') // prayers can be set to private in Rock
        .andFilter(`Answer eq null or Answer eq ''`) // prayers that aren't answered
        .sort([
          { field: 'EnteredDateTime', direction: 'desc' }, // newest prayer first
        ])
        .transform((results) => results.map(({ id }) => id))
        .get();

    return await Cache.request(request, {
      key: Cache.KEY_TEMPLATES.personPrayers`${id}`,
      expiresIn: 60 * 60 * 12, // 12 hour cache
    });
  }

  async byCurrentUser() {
    const { Auth } = this.context.dataSources;
    const { primaryAliasId } = await Auth.getCurrentPerson();

    return this.request()
      .filter(`RequestedByPersonAliasId eq ${primaryAliasId}`) // only show your own prayers
      .andFilter(`IsActive eq true`) // prayers can be marked as "in-active" in Rock
      .andFilter(`IsApproved eq true`) // prayers can be moderated in Rock
      .andFilter('IsPublic eq true') // prayers can be set to private in Rock
      .andFilter(`Answer eq null or Answer eq ''`) // prayers that aren't answered
      .sort([
        { field: 'EnteredDateTime', direction: 'desc' }, // newest prayer first
      ])
      .transform((
        prayers // note : we need to add the TypeName explicitly to this to get node to resolve
      ) => prayers.map((prayer) => ({ ...prayer, __typename: 'PrayerRequest' })));
  }
}
