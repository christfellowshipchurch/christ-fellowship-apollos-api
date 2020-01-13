import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

export default class Address extends RockApolloDataSource {
    resource = 'Locations'

    getByUser = async () => {
        const family = await this.context.dataSources.Person.getFamilyByUser()

        if (family) {
            const { id: familyId } = family

            try {
                const location = await this
                    .request(`/GroupLocations`)
                    .filter(`
                        (GroupId eq ${familyId})
                        and
                        (GroupLocationTypeValueId eq ${get(ApollosConfig, 'ROCK_MAPPINGS.LOCATION_TYPES.HOME_ADDRESS', 0)})
                    `)
                    .first()

                if (location) {
                    const { locationId } = location
                    return this.request().filter(`Id eq ${locationId}`).first()
                }


            } catch (e) {
                console.log({ e })
                console.log(`This is likely because the the following family does not have an address associated with it: ${familyId}`)
            }
        }
        return null
    }

    // TODO : Create this as a Rock Workflow cause there's way too much Rock specific logic to try and ahere to
    updateByUser = async ({ street1, street2, city, state, postalCode }) => {
        // get the family id for the current user
        const { id: personId } = await this.context.dataSources.Auth.getCurrentPerson()

        // create a new location
        const location = await this.post('/Locations', {
            Street1: street1,
            Street2: street2,
            City: city,
            State: state,
            PostalCode: postalCode,
            Country: 'US' // TODO : assuming US for now, to be updated later
        })

        if (location) {
            const { guid: locationGuid } = await this
                .request(`/Locations/${location}`)
                .get()

            const workflow = await this.context.dataSources.Workflow.trigger({
                id: get(ApollosConfig, 'ROCK_MAPPINGS.WORKFLOW_IDS.ADDRESS_UPDATE'),
                attributes: {
                    address: locationGuid,
                    personId
                }
            })

            if (workflow.status === 'Completed') {
                return { street1, street2, city, state, postalCode }
            }
        }

        return null

    }
}
