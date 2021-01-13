import gql from 'graphql-tag';

export default gql`
  # type SearchResultsConnection {
  #   edges: [SearchResult]
  #   pageInfo: PaginationInfo
  # }

  # ⚠️ Not sure about this... ideally, there'd already be an interface that the existing
  # type SearchResult implements...
  interface SearchResultItem {
    cursor: String
    node: Node
  }

  type SearchGroupsResult implements SearchResultItem {
    cursor: String
    node: Node

    # :: Group attributes from Algolia
    # title: String
    # summary: String
    # coverImage: ImageMedia
    # groupType: GROUP_TYPE
    # meetingDays: ['mon', 'sun']
  }

  extend type Query {
    searchGroups: SearchGroupsResult
  }
`