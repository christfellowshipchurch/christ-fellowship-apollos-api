import gql from 'graphql-tag'

export default gql`
  type Metadata {
    name: String
    content: String
  }

  extend type Query { 
    metadata(relatedNode: ID!): [Metadata]
  }
`