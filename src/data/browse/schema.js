import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  extend type Query {
    getBrowseFilters: [ContentChannel]
    getBrowseCategories(filter: String): [ContentItem]
    getBrowseContent(category: String!, filter: String): [ContentItem]
  }
`