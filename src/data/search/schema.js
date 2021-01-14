import gql from 'graphql-tag';

export default gql`
  type SearchResultsConnection {
    edges: [SearchResult]
    pageInfo: PaginationInfo
  }

  interface SearchResult {
    cursor: String
    node: Node
  }

  enum SearchIndexAction {
    update
    delete
  }
`