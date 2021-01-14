import {
  parseCursor,
  createCursor,
} from '@apollosproject/server-core';

/**
 * Manages interface with Algolia SDK, adding convenience functions
 * for common operations/tasks in our API.
 */
export default class SearchIndex {
  constructor(client, id, indexConfig = {}) {
    const { INDEX, SEARCH_RESULT_TYPENAME, CONFIGURATION } = indexConfig;

    if (!indexConfig || !INDEX || !SEARCH_RESULT_TYPENAME || !CONFIGURATION) {
      console.warn(`Cannot create SearchIndex id "${id}" due to missing configuration values. Please verify your config.yml has correct ALGOLIA values.`)
    }

    this.id = id;
    this.indexName = INDEX;
    this.searchResultTypename = SEARCH_RESULT_TYPENAME;
    this.configuration = CONFIGURATION;

    this.index = client.initIndex(this.indexName);
    this.index.setSettings(this.configuration);

    console.log(`[🗄️ SearchIndex] Created "${this.id}" => "${this.indexName}"`);
  }

  async addObject(args) {
    return new Promise((resolve, reject) => {
      this.index.addObject(args, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  async addObjects(args) {
    return new Promise((resolve, reject) => {
      this.index.addObjects(args, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  async byPaginatedQuery({ query, after, first = 20 }) {
    // Prepare pagination
    const length = first;
    let offset = 0;

    if (after) {
      const parsed = parseCursor(after);

      if (parsed && Object.hasOwnProperty.call(parsed, 'position')) {
        offset = parsed.position + 1;
      } else {
        throw new Error(`An invalid 'after' cursor was provided: ${after}`);
      }
    }

    // Perform search
    const { hits } = await this.index.search({ query, length, offset });

    return hits.map((hit, i) => ({
      ...hit,
      cursor: createCursor({ position: i + offset }),
      __typename: this.searchResultTypename,
    }));
  }
}