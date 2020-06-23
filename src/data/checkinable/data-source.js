import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import { first } from 'lodash'
import { getIdentifierType } from '../utils'

const { ROCK_CONSTANTS } = ApollosConfig;

export default class Checkinable extends RockApolloDataSource {

    getByContentItem = async (id) => {
        const { ContentItem, Cache } = this.context.dataSources;
        // Get the content item from the ID passed in
        const contentItem = await ContentItem.getFromId(id);

        // Find an attribute that contains the word 'group' and 
        // is also a group type in Rock
        const { attributes, attributeValues } = contentItem;
        const groupKey = Object.keys(attributes).find(key =>
            key.toLowerCase().includes('group')
            && attributes[key].fieldTypeId === ROCK_CONSTANTS.GROUP)

        if (groupKey && groupKey !== '' || true) {
            // The workflow in Rock requires an integer id, so if
            // the attribute value we get is a guid, we need to get
            // the id from Rock and cache the value in Redis for later
            // access.
            // const groupValue = attributeValues[groupKey].value
            // TODO : remove this when done testing
            const groupValue = 766112
            const identifier = getIdentifierType(groupValue)
            switch (identifier.type) {
                case 'int':
                    return {
                        id: identifier.value,
                        title: 'Check In',
                        message: "Let us know you're here!",
                        isCheckedIn: false
                    }
                case 'guid':
                    // just for testing
                    const cachedKey = `groupId_${groupValue}`
                    const cachedValue = await Cache.get({
                        key: cachedKey,
                    });

                    if (cachedValue) {
                        return cachedValue;
                    }

                    // Rock returns results as an array, so we want to grab the first 
                    // before we deconstruct to get the id
                    const group = await this.request(`Groups`).filter(identifier.query).get()
                    const { id } = first(group)

                    if (id) {
                        Cache.set({
                            key: cachedKey,
                            data: id,
                            expiresIn: 60 * 60 * 24 // 24 hour cache
                        });
                    }

                    return {
                        id,
                        title: 'Check In',
                        message: "Let us know you're here!",
                        isCheckedIn: false
                    }

                default:
                    break;
            }
        }

        return null
    }
}
