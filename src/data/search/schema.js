import gql from 'graphql-tag';

export default gql`
  type SearchResultsConnection {
    edges: [SearchResult]
    pageInfo: PaginationInfo
  }

  type SearchResult {
    cursor: String
    title: String
    summary: String
    coverImage: ImageMedia
    node: Node
  }

  enum INDEX_ACTION {
    update
    delete
  }

  input SearchGroupsInput {
    text: String
    campusNames: [String]
    preferences: [String]
    subPreferences: [String]
    days: [String]
  }

  input SearchQueryInput {
    attributes: [SearchQueryAttributeInput]
  }

  input SearchQueryAttributeInput {
    key: String
    values: [String]
  }

  # Search Integrations by data types/modules
  extend type Query {
    # ContentItems
    search(query: String!, first: Int, after: String): SearchResultsConnection

    # Groups
    searchGroups(query: SearchQueryInput!, first: Int, after: String): SearchResultsConnection
  }

  extend type Mutation {
    # ContentItems
    indexContentItem(id: String, action: INDEX_ACTION, key: String): String

    # Groups
    indexGroup(id: String, action: INDEX_ACTION, key: String): String
  }
`