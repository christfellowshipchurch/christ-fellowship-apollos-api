import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  extend type Query {
    getBrowseFilters: [ContentChannel] @deprecated(reason: "Use browseFilters instead")
    browseFilters: [ContentItem]
  }
`