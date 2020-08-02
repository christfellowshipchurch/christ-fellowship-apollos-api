import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get, filter, find } from 'lodash'
import { Utils } from '@apollosproject/data-connector-rock'


const { enforceCurrentUser, createImageUrlFromGuid } = Utils

const resolver = {
    Person: {
        photo: ({ photo: { guid } }) => (guid
            ? { uri: createImageUrlFromGuid(guid) }
            : { uri: "https://cloudfront.christfellowship.church/GetImage.ashx?guid=0ad7f78a-1e6b-46ad-a8be-baa0dbaaba8e" }),
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
        updateAddress: (root, { address }, { dataSources }) =>
            dataSources.Address.updateByUser(address),
        updateProfileField: async (root, { input: { field, value } }, { dataSources }) => {
            if (field === 'PhoneNumber') {
                await dataSources.PhoneNumber.updateByUser(value)
                return dataSources.Auth.getCurrentPerson()
            } else {
                return dataSources.Person.updateProfileWithAttributes([{ field, value }])
            }
        },
        updateProfileFields: async (root, { input }, { dataSources }) => {
            const otherFields = filter(input, n => n.field !== 'PhoneNumber')
            const phoneNumber = find(input, n => n.field === 'PhoneNumber')

            await Promise.all([
                (otherFields.length
                    ? dataSources.Person.updateProfileWithAttributes(otherFields)
                    : () => { }),
                (get(phoneNumber, 'value', '') !== ''
                    ? dataSources.PhoneNumber.updateByUser(phoneNumber.value)
                    : () => { })
            ])

            return dataSources.Auth.getCurrentPerson()
        },
        updateCommunicationPreference: (root, { type, allow }, { dataSources }) =>
            dataSources.Person.updateCommunicationPreference({ type, allow }),
        updateCommunicationPreferences: async (root, { input }, { dataSources }) => {
            await Promise.all(input.map(({ type, allow }) =>
                dataSources.Person.updateCommunicationPreference({ type, allow })
            ))

            return await dataSources.Auth.getCurrentPerson()
        },
        submitRsvp: (root, { input }, { dataSources }) =>
            dataSources.Person.submitRsvp(input),
        submitEmailCapture: (root, { input }, { dataSources }) =>
            dataSources.Person.submitEmailCapture(input)
    }
}

export default resolverMerge(resolver, corePerson)
