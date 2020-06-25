import { gql } from 'apollo-server'

export default gql`
    enum FLAG_STATUS {
        LIVE
        DISABLED
    }
    
    extend type Query {
        flagStatus(key:String!): FLAG_STATUS
    }
`