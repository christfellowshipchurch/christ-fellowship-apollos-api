import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

import * as EventContentItem from '../event-content-item'

export default gql`
  ${ContentItem.schema}
  ${EventContentItem.schema}

  extend type DevotionalContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    publishDate: String
    author: Person
  }

  extend type UniversalContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    publishDate: String
    author: Person
  }

  extend type ContentSeriesContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    publishDate: String
    author: Person
  }

  extend type MediaContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    publishDate: String
    author: Person
  }

  extend type WeekendContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    publishDate: String
    author: Person
  }

  extend type Query { 
    getContentItemByTitle(title: String!): ContentItem
    allEvents: [EventContentItem]
  }
`