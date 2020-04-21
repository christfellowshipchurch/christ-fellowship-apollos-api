import {
    Person as corePerson,
} from '@apollosproject/data-connector-rock'
import {
    get,
    has,
    forEach,
    camelCase,
    replace,
    snakeCase
} from 'lodash'
import ApollosConfig from '@apollosproject/config'
import moment from 'moment'
import {
    getIdentifierType
} from '../utils'

const RockGenderMap = {
    Unknown: 0,
    Male: 1,
    Female: 2,
}

const RockAttributeValues = {
    Ethnicity: 'Ethnicity',
    BaptismDate: 'BaptismDate',
    SalvationDate: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.SALVATION')
}

export default class Person extends corePerson.dataSource {
    expanded = true

    // Overrides the Core method to allow for the Id
    //  passed to be either an int or guid
    getFromId = (id) =>
        this.request()
            .filter(getIdentifierType(id).query)
            .expand('Photo')
            .first()

    getFromAliasId = async (id) => {
        // Fetch the PersonAlias, selecting only the PersonId.
        const personAlias = await this.request('/PersonAlias')
            .filter(getIdentifierType(id).query)
            .select('PersonId')
            .first();

        // If we have a personAlias, return him.
        if (personAlias) {
            return this.getFromId(personAlias.personId);
        }
        // Otherwise, return null.
        return null;
    }

    parseDateAsBirthday = (date) => {
        const birthDate = moment(date);

        if (!birthDate.isValid()) {
            throw new UserInputError('BirthDate must be a valid date');
        }

        return {
            // months in moment are 0 indexed
            BirthMonth: birthDate.month() + 1,
            BirthDay: birthDate.date(),
            BirthYear: birthDate.year(),
        }
    }

    getGenderKey = (gender) => {
        if (!['Male', 'Female'].includes(gender)) {
            return RockGenderMap.Unknown
        }

        return RockGenderMap[gender];
    }

    reduceUpdateProfileInput = (input) => this.reduceInput(input)
    reduceInput = (input) => input.reduce(
        (accum, { field, value }) => ({
            ...accum,
            [field]: value,
        }),
        {}
    )

    getFamilyByUser = async () => {
        const { id: personId } = await this.context.dataSources.Auth.getCurrentPerson()
        return this
            .request(`/Groups/GetFamilies/${personId}`)
            .first()
    }

    getAttributeByKey = async ({ personId, key }) => {
        key = camelCase(replace(key, /\s|[-]/g, ''))
        if (personId) {
            const { attributeValues } = await this.request(`/People/${personId}`).get()

            return get(attributeValues, `${key}.value`, null)
        }

        throw Error("You must pass in a personId to get a person's attribute")
    }

    updateProfileWithAttributes = async (fields) => {
        // requires auth
        const currentPerson = await this.context.dataSources.Auth.getCurrentPerson()

        if (!currentPerson.id) throw new AuthenticationError('Invalid Credentials')

        // placeholder arrays
        let attributeValueFields = []
        let attributeFields = []
        let updatedAttributeValues = {}

        // map attributes and attribute values to separate arrays
        fields.map(n => has(RockAttributeValues, n.field)
            ? attributeValueFields.push(n)
            : attributeFields.push(n)
        )

        // Rock only allows for 1 attribute value to be updated at a time
        // we loop through each of the attributeValueFields in order to update them one at a time
        // TODO : create a workflow that handles this cause one at a time is just rediculous
        forEach(attributeValueFields, async (n, i) => {
            try {
                const snakeCaseField = snakeCase(n.field).toUpperCase()
                const key = get(ApollosConfig, `ROCK_MAPPINGS.PERSON_ATTRIBUTES.${snakeCaseField}`, null)

                if (!key) throw new Error('There is no Attribute Value key found in the config for the following attribute:', n.field)

                const attributeKey = `attributeKey=${key}`
                const attributeValue = `attributeValue=${n.value}`
                const response = await this.post(`/People/AttributeValue/${currentPerson.id}?${attributeKey}&${attributeValue}`)

                if (response) {
                    updatedAttributeValues[n.field] = n.value
                } else {
                    throw new Error(`Something went wrong while updating the following attribute value: ${n.field}`)
                }
            } catch (e) {
                console.log("Error:", { e })
                throw new Error(`There was an issue updating the following attribute value: ${n.field}`)
            }
        })

        // Run the normal updateProfile method if there are attributeFields to update
        if (attributeFields.length) {
            const updatedProfileFields = await this.updateProfile(attributeFields)

            // updateProfile returns the deconstructed currentPerson
            // there's no need to add it to this return value
            return {
                ...updatedProfileFields,
                ...updatedAttributeValues
            }
        } else {
            return {
                ...currentPerson,
                ...updatedAttributeValues
            }
        }
    }

    updateCommunicationPreference = async ({ type, allow }) => {
        const currentPerson = await this.context.dataSources.Auth.getCurrentPerson()

        if (currentPerson.id) {
            switch (type) {
                case 'SMS':
                    try {
                        await this.context.dataSources.PhoneNumber.updateEnableSMS(allow)
                    } catch (e) {
                        throw new Error(e)
                    }

                    return this.context.dataSources.Auth.getCurrentPerson()
                case 'Email':
                    await this.patch(`/People/${currentPerson.id}`, {
                        EmailPreference: allow ? 0 : 2
                    })

                    return this.context.dataSources.Auth.getCurrentPerson()
            }
        }

        console.error("You must be logged in to update your communication preference")
    }

    getSpouseByUser = async () => {
        try {
            const { id, primaryFamilyId } = await this.context.dataSources.Auth.getCurrentPerson()

            return id
                ? this.request()
                    .filter(`PrimaryFamilyId eq ${primaryFamilyId} and Id ne ${id} and MaritalStatusValueId eq 143`)
                    .expand('Photo')
                    .first()
                : null
        } catch (e) {
            console.log({ e })
            console.log(`This is likely because the the following family does not a spouse associated with it: ${familyId}`)
        }

        return null
    }

    getChildrenByUser = async () => {
        try {
            const { id, primaryFamilyId } = await this.context.dataSources.Auth.getCurrentPerson()

            return id
                ? this.request()
                    .filter(`PrimaryFamilyId eq ${primaryFamilyId} and Id ne ${id} and MaritalStatusValueId ne 143`)
                    .expand('Photo')
                    .get()
                : null
        } catch (e) {
            console.log({ e })
            console.log(`This is likely because the the following family does not have children associated with it: ${familyId}`)
        }

        return null
    }

    submitRsvp = async (input) => {
        // Set the default return value of a workflow attribute
        // to null in order to make it easier to check in the 
        // conditional statement later
        const reducedInput = this.reduceInput(input)
        const attributes = {
            firstName: get(reducedInput, 'firstName', null),
            lastName: get(reducedInput, 'lastName', null),

            adults: get(reducedInput, 'adults', 1),
            children: get(reducedInput, 'children', 0),

            visitDate: get(reducedInput, 'visitDate', null),
            visitTime: get(reducedInput, 'visitTime', null),

            email: get(reducedInput, 'email', null),
        }

        // Only run the method if the following attributes
        // are found in the attributes object
        if (attributes.firstName
            && attributes.lastName
            && attributes.visitDate
            && attributes.visitTime
            && attributes.email) {
            try {
                // Check for a valid phone number
                const {
                    valid,
                    numericOnlyPhoneNumber
                } = this.context.dataSources.PhoneNumber.parsePhoneNumber(get(reducedInput, 'phoneNumber', ''))


                if (valid) {
                    // Get the Campus Guid from the campus name
                    const { guid } = await this.context.dataSources.Campus.getByName(
                        get(reducedInput, 'campus', '')
                    )

                    if (guid) {
                        const workflow = await this.context.dataSources.Workflow.trigger({
                            id: get(ApollosConfig, 'ROCK_MAPPINGS.WORKFLOW_IDS.RSVP'),
                            attributes: {
                                ...attributes,
                                phoneNumber: numericOnlyPhoneNumber,
                                campus: guid
                            }
                        })

                        return workflow.status
                    }
                }
            } catch (e) {
                console.log({ e })
            }
        }

        // Default return value
        return "Failed"
    }

    submitEmailCapture = async (input) => {
        // Set the default return value of a workflow attribute
        // to null in order to make it easier to check in the 
        // conditional statement later
        const reducedInput = this.reduceInput(input)
        const attributes = {
            firstName: get(reducedInput, 'firstName', null),
            lastName: get(reducedInput, 'lastName', null),
            email: get(reducedInput, 'email', null),
        }

        // Only run the method if the following attributes
        // are found in the attributes object
        if (attributes.firstName
            && attributes.lastName
            && attributes.email) {
            try {
                const workflow = await this.context.dataSources.Workflow.trigger({
                    id: get(ApollosConfig, 'ROCK_MAPPINGS.WORKFLOW_IDS.EMAIL_CAPTURE'),
                    attributes
                })

                return workflow.status
            } catch (e) {
                console.log({ e })
            }
        }

        // Default return value
        return "Failed"
    }
}
