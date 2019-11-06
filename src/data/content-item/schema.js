import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  ${ContentItem.schema}

  type ContentDecorations {
    tags: [String]
    icon: String
  }

  extend type Query {
    contentDecorations(id: ID!): ContentDecorations
  }
`