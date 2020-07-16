import {
    PrayerRequest as corePrayerRequest,
} from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'

const { ROCK_MAPPINGS } = ApollosConfig

export default class PrayerRequest extends corePrayerRequest.dataSource {

    baseByDailyPrayerFeed = this.byDailyPrayerFeed

    byDailyPrayerFeed = async () => {
        const requestBuilder = await this.baseByDailyPrayerFeed()

        return requestBuilder
            .andFilter(`CategoryId eq ${ROCK_MAPPINGS.GENERAL_PRAYER_CATEGORY_ID}`)
    }

}