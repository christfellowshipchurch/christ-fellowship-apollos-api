/**
 * A custom re-implementation of @apollosproject/apollos-data-connector-algolia-search
 * in order to support multiple indices and Algolia configurations.
 */
import ApollosConfig from '@apollosproject/config';
import algoliasearch from 'algoliasearch';
import {
  parseCursor,
  createCursor,
  createGlobalId,
} from '@apollosproject/server-core';

// :: Sub-Class
export class SearchIndex {
  constructor(id, indexConfig) {
    this.id = id;
    this.indexConfig = indexConfig;

    this.index = CLIENT.initIndex(indexConfig.INDEX);
    this.index.setSettings(indexConfig.CONFIGURATION);
    console.log('[🔖 SearchIndex]');
    console.log(`-->  id: ${this.id}`);
    console.log(`-->  index name: ${indexConfig.INDEX}`);
    console.log('-->  index: ', this.index);
  }
}

// Global configuration/setup
// ----------------------------------------------------------------------------
let CLIENT;
let INDICES;
let INDICES_CONFIG;

// Initialize Client
if (ApollosConfig.ALGOLIA.APPLICATION_ID && ApollosConfig.ALGOLIA.API_KEY) {
  CLIENT = algoliasearch(
    ApollosConfig.ALGOLIA.APPLICATION_ID,
    ApollosConfig.ALGOLIA.API_KEY
  );
} else {
  console.warn(
    'You are using the Algolia Search datasource without Algolia credentials. To avoid issues, add Algolia credentials to your config.yml or remove the SearchGroups datasource'
  );
}

// Initialize Indices
if (ApollosConfig.ALGOLIA.INDICES) {
  INDICES_CONFIG = ApollosConfig.ALGOLIA.INDICES;
  INDICES = {};

  for (let indexKey in INDICES_CONFIG) {
    console.log(`🔌 Initializing Algolia Search index ${indexKey}...\n`, INDICES_CONFIG[indexKey]);

    if (INDICES[indexKey]) {
      // Error: Duplicate index
      console.warn(`Duplicate Algolia index configuration key "${indexKey}"`);
    } else {
      INDICES[indexKey] = new SearchIndex(indexKey, INDICES_CONFIG[indexKey]);
    }
  }
} else {
  console.warn(
    'You do not have any Algolia Search indices configured. Check your config.yml and ensure ALGOLIA.INDICES is configured properly.'
  )
}


// Replacement Class/DataSource
// ----------------------------------------------------------------------------


// :: Main-Class
export default class SearchGroups {
  constructor() {
    console.log('[SearchGroups] 🆕 *** constructor() ');
    this.client = CLIENT;
    this.indices = INDICES;

    console.log('ApollosConfig.ALGOLIA.INDICES:', ApollosConfig.ALGOLIA.INDICES);

    if (!CLIENT) {
      // ⚠️ TODO :: Stub for testing
      console.warn('No global Algolia search CLIENT set, so index methods need mocked for tests!');
    }

    console.log('this.client:', !!this.client);
    console.log('this.indices:', this.indices);
  }

  initialize({ context }) {
    this.context = context;
    console.log('[SearchGroups] initialize()');
  }

  index(key) {
    if (this.indices[key]) {
      return this.indices[key];
    }

    console.warn('No Search Index ')
  }
}
