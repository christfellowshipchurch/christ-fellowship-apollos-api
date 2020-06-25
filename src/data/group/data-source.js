import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import { first } from 'lodash'
import { getIdentifierType } from '../utils'

export default class Group extends RockApolloDataSource {
    resource = 'Groups'

    getFromId = async (id) => {
        const { Cache } = this.context.dataSources;
        const identifier = getIdentifierType(id)

        const cachedKey = `group_${identifier.value}`
        const cachedValue = await Cache.get({
            key: cachedKey,
        });

        if (cachedValue) {
            return cachedValue;
        }

        // Rock returns results as an array, so we want to grab the first 
        const groups = await this.request(`Groups`).filter(identifier.query).get()
        const group = first(groups)

        if (group) {
            Cache.set({
                key: cachedKey,
                data: group,
                expiresIn: 60 * 60 * 24 // 24 hour cache
            });
        }

        return group
    }
}
