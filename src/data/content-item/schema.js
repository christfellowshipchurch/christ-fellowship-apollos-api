import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  ${ContentItem.schema}

  extend type DevotionalContentItem {
    tags: [String]
    icon: String
  }

  extend type UniversalContentItem {
    tags: [String]
    icon: String
  }

  extend type ContentSeriesContentItem {
    tags: [String]
    icon: String
  }

  extend type MediaContentItem {
    tags: [String]
    icon: String
  }

  extend type WeekendContentItem {
    tags: [String]
    icon: String
  }

`