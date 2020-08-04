import * as CoreSearch from '@apollosproject/data-connector-algolia-search';

export const resolver = CoreSearch.resolver
export const schema = CoreSearch.schema
export const jobs = CoreSearch.jobs

export { default as dataSource } from './data-source';