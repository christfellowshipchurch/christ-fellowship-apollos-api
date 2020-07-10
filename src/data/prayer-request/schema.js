import {
    prayerSchema as corePrayerSchema
} from '@apollosproject/data-schema';
import gql from 'graphql-tag'


export default gql`
    ${corePrayerSchema}

    extend type Query {
        dailyPrayers: PrayerListFeature
    }
`
