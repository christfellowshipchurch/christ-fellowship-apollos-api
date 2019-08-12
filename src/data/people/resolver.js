import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'
import { Utils } from '@apollosproject/data-connector-rock'


const { enforceCurrentUser } = Utils

const resolver = {
    Person: {
        ethnicity: enforceCurrentUser(({ attributeValues }) =>
            get(attributeValues, 'ethnicity.value', null)),
        address: (root, args, { dataSources }) =>
            dataSources.Address.getByUser(),
        baptismDate: enforceCurrentUser(({ attributeValues }) =>
            get(attributeValues, 'baptismDate.value', null)),
        salvationDate: enforceCurrentUser((root) => {
            console.log({ root })


            return get(
                root.attributeValues,
                `${get(ApollosConfig, 'ROCK_MAPPING.PERSON_ATTRIBUTES.SALVATION')}`,
                null)
        }),
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
