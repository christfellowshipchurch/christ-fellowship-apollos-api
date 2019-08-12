import {
    Person as corePerson,
} from '@apollosproject/data-connector-rock'
import moment from 'moment'
import { get } from 'lodash'

const RockGenderMap = {
    Unknown: 0,
    Male: 1,
    Female: 2,
}

export default class Person extends corePerson.dataSource {
    expanded = true

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

    reduceUpdateProfileInput = (input) => input.reduce(
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
        if (personId) {
            console.log({ key })

            const { attributeValues } = await this.request(`/People/${personId}`).get()

            return get(attributeValues, `${key}.value`, null)
        }

        throw Error("You must pass in a personId to get a person's attribute")
    }
}
