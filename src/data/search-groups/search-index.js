/**
 * Manages interface with Algolia SDK, adding convenience functions
 * for common operations/tasks in our API.
 */
export default class SearchIndex {
  constructor(client, id, indexConfig) {
    this.id = id;
    this.indexConfig = indexConfig;

    this.index = client.initIndex(indexConfig.INDEX);
    this.index.setSettings(indexConfig.CONFIGURATION);

    console.log(`[🗄️ SearchIndex] Created "${this.id}" => "${indexConfig.INDEX}"`);
  }

  test() {
    return {
      cursor: "abc123-mock-cursor",
      node: null
    }
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

  // options = { query:String, after:Int, first:Int = 20 }
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

    return hits.map((node, i) => ({
      ...node,
      cursor: createCursor({ position: i + offset }),
    }));
  }
}