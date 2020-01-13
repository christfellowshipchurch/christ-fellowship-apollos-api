import { ContentItem } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  type Event implements Node {
    id: ID!
    name: String
    description: String
    location: String
    start: String
    end: String
    image: ImageMedia
    campuses: [Campus]
  }
  
  extend type Campus {
    events: [Event]
  }
`