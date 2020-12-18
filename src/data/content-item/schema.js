import { ContentItem } from '@apollosproject/data-connector-rock';
import gql from 'graphql-tag';

import * as EventContentItem from '../event-content-item';
import * as InformationalContentItem from '../informational-content-item';
import * as WebsiteContentItem from '../website-content-item';
import * as WebsiteHtmlContentItem from '../website-html-content-item';
import * as WebsiteFeature from '../website-feature';
import * as WebsiteGroupContentItem from '../website-group-content-item';
import * as WebsitePagesContentItem from '../website-pages-content-item';

export default gql`
  ${ContentItem.schema}
  ${EventContentItem.schema}
  ${InformationalContentItem.schema}
  ${WebsiteHtmlContentItem.schema}
  ${WebsiteFeature.schema}
  ${WebsiteGroupContentItem.schema}
  ${WebsitePagesContentItem.schema}
  ${WebsiteContentItem.schema}

  extend type DevotionalContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    author: Person
  }

  extend type UniversalContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    author: Person
  }

  extend type ContentSeriesContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    author: Person
  }

  extend type MediaContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    author: Person
  }

  extend type WeekendContentItem {
    tags: [String]
    icon: String
    estimatedTime: String
    author: Person
  }

  extend type Query {
    getContentItemByTitle(title: String!): ContentItem
    getCategoryByTitle(title: String!): ContentItem
    allEvents: [EventContentItem]
    featuredEvents: ContentItemsConnection
    sermons(first: Int, after: String): ContentItemsConnection
  }
`;
