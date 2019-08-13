import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'
import { Utils } from '@apollosproject/data-connector-rock'


const { enforceCurrentUser } = Utils

const resolver = {
    Person: {
        address: (root, args, { dataSources }) =>
            dataSources.Address.getByUser(),
        ethnicity: enforceCurrentUser(({ id }, args, { dataSources }) =>
            dataSources.Person.getAttributeByKey({
                personId: id,
                key: 'ethnicity'
            })),
        baptismDate: enforceCurrentUser(({ id }, args, { dataSources }) =>
            dataSources.Person.getAttributeByKey({
                personId: id,
                key: 'baptismDate'
            })),
        salvationDate: enforceCurrentUser(({ id }, args, { dataSources }) =>
            dataSources.Person.getAttributeByKey({
                personId: id,
                key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.SALVATION')
            })),
    },
    Query: {
        getEthnicityList: (root, args, { dataSources }) =>
            dataSources.DefinedValueList.getByIdentifier(
                get(ApollosConfig, 'ROCK_MAPPINGS.DEFINED_TYPES.ETHNICITY')
            ),
    },
    Mutation: {
        updateAddress: (root, args, { dataSources }) =>
            dataSources.Address.updateByUser({ ...args }),
        updateProfileField: (root, { input: { field, value } }, { dataSources }) =>
            dataSources.Person.updateProfileWithAttributes([{ field, value }]),
        updateProfileFields: (root, { input }, { dataSources }) =>
            dataSources.Person.updateProfileWithAttributes(input),
    }
}

export default resolverMerge(resolver, corePerson)
