import { searchSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';


export default gql`
  # ${searchSchema}

  # ✂️ searchSchema --------------------------------------------

  # extend type Query {
  #   search(query: String!, first: Int, after: String): SearchResultsConnection
  # }

  # type SearchResultsConnection {
  #   edges: [SearchResult]
  #   pageInfo: PaginationInfo
  # }

  # type SearchResult {
  #   cursor: String
  #   title: String
  #   summary: String
  #   coverImage: ImageMedia
  #   node: Node
  # }

  # ✂️ --------------------------------------------

  # enum INDEX_ACTION {
  #   update
  #   delete
  # }

  # extend type Mutation {
  #   indexContentItem(id: String, action: INDEX_ACTION, key: String): String
  # }
`