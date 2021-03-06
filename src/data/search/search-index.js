import { parseCursor, createCursor } from '@apollosproject/server-core';

/**
 * Manages interface with Algolia SDK, adding convenience functions
 * for common operations/tasks in our API.
 */
export default class SearchIndex {
  constructor(client, id, indexConfig = {}) {
    const { INDEX, CONFIGURATION } = indexConfig;

    if (!indexConfig || !INDEX || !CONFIGURATION) {
      console.warn(
        `Cannot create SearchIndex id "${id}" due to missing configuration values. Please verify your config.yml has correct ALGOLIA values.`
      );
    }

    this.id = id;
    this.indexName = INDEX;
    this.configuration = CONFIGURATION;

    this.index = client.initIndex(this.indexName);
    this.index.setSettings(this.configuration);
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

  async deleteObject(args) {
    // Note: this isn't promisified since the only usage didn't require it.
    this.index.deleteObject(args);
  }

  async byPaginatedQuery({ query, filters, after, first = 20 }) {
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
    const results = await this.index.search({ query, filters, length, offset });
    const { hits, nbHits: totalResults } = results;

    return {
      totalResults,
      edges: hits.map((hit, i) => ({
        ...hit,
        cursor: createCursor({ position: i + offset }),
      }))
    };
  }

  async byFacets() {
    const { facets } = await this.index.search('', { facets: ['*'] });
    return facets;
  }
}
