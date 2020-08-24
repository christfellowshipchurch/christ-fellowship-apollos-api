import gql from 'graphql-tag'

export default gql`
  input MessagesConnectionInput {
    first: Int
    after: String
  }

  type MessagesConnection {
    edges: [MessagesConnectionEdge]
    totalCount: Int
    pageInfo: PaginationInfo
  }

  type MessagesConnectionEdge {
    node: Message
    cursor: String
  }

  type Message implements Node {
    id: ID!
    title(hyphenated: Boolean): String
    subtitle(hyphenated: Boolean): String
    body(hyphenated: Boolean): String
    date: String
  }

  extend type Query { 
    notificationCenter: MessagesConnection
  }
`