import { gql } from 'apollo-server';

export default gql`
  type NodeConnection {
    edges: [NodeConnectionEdge]
    totalCount: Int
    pageInfo: PaginationInfo
  }

  type NodeConnectionEdge {
    node: Node
    cursor: String
  }
`;
