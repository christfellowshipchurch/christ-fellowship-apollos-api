import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';

const { ROCK_MAPPINGS } = ApollosConfig;
const { DEFINED_TYPES } = ROCK_MAPPINGS;
const { URLS: UrlDefinedTypeId } = DEFINED_TYPES;

export default class Url extends RockApolloDataSource {
  getFromId(url) {
    // the url gets encoded as the id, so we can just return it with no fuss
    return url;
  }

  /**
   * Gets a url from a Rock Defined Value Id
   * @param {string} id - Rock Defined Value Id
   */
  async getFromMasterList(id) {
    if (!id) return null;

    const definedValue = await this.request('/DefinedValues')
      .filter(`Id eq ${id}`)
      .andFilter('IsActive eq true')
      .first();

    return {
      url: get(definedValue, 'description'),
      title: get(definedValue, 'value'),
      id: get(definedValue, 'id'),
    };
  }

  /**
   * Adds a url to the master list of urls
   * @param {string} url
   */
  async addToMasterList({ url, title }) {
    /**
     * Check to see if the url exists today
     */
    const { id, status } = await this.masterListStatus({ url, title });

    /**
     * If the url exists in rock but is inactive, we just patch to activate it
     */
    if (status === 'inactive') {
      await this.patch(`/DefinedValues/${id}`, { IsActive: true });
      return id;
    }

    /**
     * If the url does not exist, we post to the Defined Value table
     * with the url and Defined Type Id
     */
    if (!status) {
      return this.post('/DefinedValues', {
        Value: title || url,
        IsSystem: false,
        Description: url,
        DefinedTypeId: UrlDefinedTypeId,
        Order: 0,
        IsActive: true,
      });
    }

    return id;
  }

  /**
   * Checks to see if the url exists in the master list of urls
   * @param {string} url
   * @returns string
   */
  async masterListStatus({ url, title }) {
    const definedValue = await this.request('/DefinedValues')
      .filter(`DefinedTypeId eq ${UrlDefinedTypeId}`)
      .andFilter(`Value eq '${title}'`)
      .andFilter(`Description eq '${url}'`)
      .first();
    const id = get(definedValue, 'id');
    const isActive = get(definedValue, 'isActive');

    if (id) {
      return {
        id,
        status: isActive ? 'active' : 'inactive',
      };
    }

    return { id, status: null };
  }

  /**
   * Gets the master list of all urls saved into the Rock
   * Defined Type where Urls are stored
   */
  masterList = () =>
    this.request('/DefinedValues')
      .filter(`DefinedTypeId eq ${UrlDefinedTypeId}`)
      .transform((results) =>
        results.map(({ value, description }) => ({
          url: description,
          title: value,
        }))
      )
      .get();
}
