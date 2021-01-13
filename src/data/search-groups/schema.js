import gql from 'graphql-tag';

export default gql`

  type SearchResultsConnection {
    edges: [SearchResultItem]
    pageInfo: PaginationInfo
  }

  enum SearchIndexAction {
    update
    delete
  }

  interface SearchResultItem {
    cursor: String
    node: Node
  }
`