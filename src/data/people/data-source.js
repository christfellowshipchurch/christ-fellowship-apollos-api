import {
    Person as corePerson,
} from '@apollosproject/data-connector-rock'
import moment from 'moment'

const RockGenderMap = {
    Unknown: 0,
    Male: 1,
    Female: 2,
}

export default class Person extends corePerson.dataSource {

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
}
