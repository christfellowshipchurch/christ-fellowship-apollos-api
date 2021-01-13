import ApollosConfig from '@apollosproject/config';
import algoliasearch from 'algoliasearch';

import SearchIndex from './search-index';

let CLIENT;
let INDICES;

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
  const indicesConfig = ApollosConfig.ALGOLIA.INDICES;
  INDICES = {};

  for (let indexKey in indicesConfig) {
    if (INDICES[indexKey]) {
      console.warn(`Duplicate Algolia index configuration key "${indexKey}"`);
    } else {
      INDICES[indexKey] = new SearchIndex(CLIENT, indexKey, indicesConfig[indexKey]);
    }
  }
} else {
  console.warn(
    'You do not have any Algolia Search indices configured. Check your config.yml and ensure ALGOLIA.INDICES is configured properly.'
  )
}

export default {
  CLIENT,
  INDICES,
}