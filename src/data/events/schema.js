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
      @deprecated(reason: "Events are no longer organized by limiting them to a physical campus. Events are organized into categories. Please reference 'EventContentItem' instead")
  }
`