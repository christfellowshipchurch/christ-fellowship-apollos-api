import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { createGlobalId } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

const resolver = {
    Address: {
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
        street1: ({ street1 }) => street1,
        street2: ({ street2 }) => street2,
        city: ({ city }) => city,
        state: ({ state }) => state,
        postalCode: ({ postalCode }) => postalCode,
    },
    Query: {
        getAddressByPerson: (root, args, { dataSources }) =>
            dataSources.Address.getByUser(),
        getStatesList: (root, args, { dataSources }) =>
            dataSources.DefinedValueList.getByIdentifier(
                get(ApollosConfig, 'ROCK_MAPPINGS.DEFINED_TYPES.STATES')
            )
    }
}

export default resolver
