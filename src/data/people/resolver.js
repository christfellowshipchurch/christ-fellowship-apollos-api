import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'
import { Utils } from '@apollosproject/data-connector-rock'


const { enforceCurrentUser } = Utils

const resolver = {
    Person: {

        phoneNumber: enforceCurrentUser(async ({ id }, args, { dataSources }) => {
            const phoneNumber = await dataSources.PhoneNumber.getByUser()

            return phoneNumber
                ? get(phoneNumber, 'number', '')
                : ''
        }),
        address: (root, args, { dataSources }) =>
            dataSources.Address.getByUser(),
        ethnicity: enforceCurrentUser(({ id }, args, { dataSources }) =>
            dataSources.Person.getAttributeByKey({
                personId: id,
                key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.ETHNICITY')
            })),
        baptismDate: enforceCurrentUser(({ id }, args, { dataSources }) =>
            dataSources.Person.getAttributeByKey({
                personId: id,
                key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.BAPTISM_DATE')
            })),
        salvationDate: enforceCurrentUser(({ id }, args, { dataSources }) =>
            dataSources.Person.getAttributeByKey({
                personId: id,
                key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.SALVATION_DATE')
            })),
        communicationPreferences: ({ emailPreference }, args, { dataSources }) => ({
            allowSMS: async () => {
                const phoneNumber = await dataSources.PhoneNumber.getByUser()

                return phoneNumber
                    ? get(phoneNumber, 'isMessagingEnabled', false)
                    : false
            },
            allowEmail: emailPreference < 2,
            allowPushNotifications: null
        })
    },
    Query: {
        getEthnicityList: (root, args, { dataSources }) =>
            dataSources.DefinedValueList.getByIdentifier(
                get(ApollosConfig, 'ROCK_MAPPINGS.DEFINED_TYPES.ETHNICITY')
            ),
        getSpouse: (root, args, { dataSources }) =>
            dataSources.Person.getSpouseByUser(),
        getChildren: (root, args, { dataSources }) =>
            dataSources.Person.getChildrenByUser(),
    },
    Mutation: {
        updateAddress: (root, args, { dataSources }) =>
            dataSources.Address.updateByUser({ ...args }),
        updateProfileField: (root, { input: { field, value } }, { dataSources }) =>
            dataSources.Person.updateProfileWithAttributes([{ field, value }]),
        updateProfileFields: (root, { input }, { dataSources }) =>
            dataSources.Person.updateProfileWithAttributes(input),
        updateCommunicationPreference: (root, { type, allow }, { dataSources }) =>
            dataSources.Person.updateCommunicationPreference({ type, allow }),
        updatePhoneNumber: async (root, { phoneNumber }, { dataSources }) => {
            await dataSources.PhoneNumber.updateByUser(phoneNumber)
            return dataSources.Auth.getCurrentPerson()
        },
    }
}

export default resolverMerge(resolver, corePerson)
