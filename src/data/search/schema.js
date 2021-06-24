import gql from 'graphql-tag';

export default gql`
  type SearchResultsConnection {
    edges: [SearchResult]
    pageInfo: PaginationInfo
    totalResults: Int
  }

  type SearchResult {
    cursor: String
    title: String
    summary: String
    coverImage: ImageMedia
    priority: Int
    node: Node
    action: ACTION_FEATURE_ACTION
  }

  enum INDEX_ACTION {
    update
    delete
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
    searchGroups(
      query: SearchQueryInput!
      first: Int
      after: String
    ): SearchResultsConnection
  }

  extend type Mutation {
    # ContentItems
    indexAllContent(action: INDEX_ACTION, key: String): String
    indexContentItem(id: String, action: INDEX_ACTION, key: String): String

    # Groups
    indexGroup(id: String, action: INDEX_ACTION, key: String): String
    indexAllGroups(action: INDEX_ACTION, key: String): String
  }
`;
