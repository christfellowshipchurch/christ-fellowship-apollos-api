import gql from 'graphql-tag';

export default gql`

  type SearchResultsConnection {
    edges: [SearchResult]
    pageInfo: PaginationInfo
  }

  enum SearchIndexAction {
    update
    delete
  }

  interface SearchResult {
    cursor: String
    node: Node
  }
`