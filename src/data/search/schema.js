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
`