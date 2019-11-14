import { ContentChannel } from '@apollosproject/data-connector-rock'
import gql from 'graphql-tag'

export default gql`
  ${ContentChannel.schema}
`