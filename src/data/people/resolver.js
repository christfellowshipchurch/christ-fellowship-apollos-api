import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

const resolver = {
    Person: {
        ethnicity: ({ attributeValues }) => '',
        address: (root, args, { dataSources }) => dataSources.Address.getByUser()
    },
    Query: {
        getEthnicityList: (root, args, { dataSources }) =>
            dataSources.DefinedValueList.getByIdentifier(
                get(ApollosConfig, 'ROCK_MAPPINGS.DEFINED_TYPES.ETHNICITY')
            ),
    },
    Mutation: {
        updateAddress: (root, args, { dataSources }) => dataSources.Address.updateByUser({ ...args })
    }
}

export default resolverMerge(resolver, corePerson)
