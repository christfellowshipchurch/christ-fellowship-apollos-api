/**
 * A custom re-implementation of @apollosproject/apollos-data-connector-algolia-search
 * in order to support multiple indices and Algolia configurations.
 */
import SearchClient from './search-client';

export default class SearchGroups {
  constructor() {
    this.client = SearchClient.CLIENT;
    this.indices = SearchClient.INDICES;

    if (!SearchClient.CLIENT) {
      // ⚠️ TODO :: Stub for testing
      console.warn('No global Algolia search CLIENT set, so index methods need mocked for tests!');
    }
  }

  initialize({ context }) {
    this.context = context;
  }

  index(key) {
    if (this.indices[key]) {
      return this.indices[key];
    } else {
      console.warn(`No search index found for key ${key}`);
    }
  }
}