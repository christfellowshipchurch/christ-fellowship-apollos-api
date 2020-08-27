import {
    PrayerRequest as corePrayerRequest,
} from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import moment from 'moment-timezone'

const { ROCK, ROCK_MAPPINGS } = ApollosConfig

export default class PrayerRequest extends corePrayerRequest.dataSource {

    baseByDailyPrayerFeed = this.byDailyPrayerFeed

    byDailyPrayerFeed = async () => {
        const requestBuilder = await this.baseByDailyPrayerFeed()

        return requestBuilder
            .andFilter(`CategoryId eq ${ROCK_MAPPINGS.GENERAL_PRAYER_CATEGORY_ID}`)
    }

    async byCurrentUser() {
        const {
            dataSources: { Auth },
        } = this.context;

        const { primaryAliasId } = await Auth.getCurrentPerson();

        return this.request()
            .filter(`RequestedByPersonAliasId eq ${primaryAliasId}`) // only show your own prayers
            .andFilter(`IsActive eq true`) // prayers can be marked as "in-active" in Rock
            .andFilter(`IsApproved eq true`) // prayers can be moderated in Rock
            .andFilter('IsPublic eq true') // prayers can be set to private in Rock
            .andFilter(`Answer eq null or Answer eq ''`) // prayers that aren't answered
            .sort([
                { field: 'PrayerCount', direction: 'asc' }, // # of times prayed, ascending
                { field: 'EnteredDateTime', direction: 'asc' }, // oldest prayer first
            ]);
    }
}