import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

export default class Address extends RockApolloDataSource {
    resource = 'Locations'

    getByUser = async () => {
        const { id: familyId } = await this.context.dataSources.Person.getFamilyByUser()

        const { locationId } = await this
            .request(`/GroupLocations`)
            .filter(`
                (GroupId eq ${familyId})
                and
                (GroupLocationTypeValueId eq ${get(ApollosConfig, 'ROCK_MAPPINGS.LOCATION_TYPES.HOME_ADDRESS', 0)})
            `)
            .first()

        return this.request().filter(`Id eq ${locationId}`).first()
    }


    updateByUser = () => null

    // TODO : Create this as a Rock Workflow cause there's way too much Rock specific logic to try and ahere to
    // updateByUser = async ({ street1, street2, city, state, postalCode }) => {
    //     // get the family id for the current user
    //     const { id: familyId } = await this.context.dataSources.Person.getFamilyByUser()

    //     // create a new location
    //     const location = await this.post('/Locations', {
    //         Street1: street1,
    //         Street2: street2,
    //         City: city,
    //         State: state,
    //         PostalCode: postalCode,
    //         Country: 'US' // TODO : assuming US for now, to be updated later
    //     })

    //     if (location) {
    //         console.log({ familyId, location })

    //         // post the family id and location id to the GroupLocations table to associate the date
    //         const groupLocation = await this.post('/GroupLocations', {
    //             GroupId: familyId,
    //             LocationId: location.id,
    //             IsMailingLocation: true,
    //             IsMappedLocation: true,
    //             Order: 0, // required by Rock
    //             GroupLocationTypeValueId: 19 // marks the address as a Home Address
    //         })

    //         return groupLocation
    //             ? location
    //             : null
    //     }

    //     return null

    // }
}
