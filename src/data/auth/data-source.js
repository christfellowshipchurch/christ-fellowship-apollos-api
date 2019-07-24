import {
    Auth as coreAuth,
} from '@apollosproject/data-connector-rock'
import { AuthenticationError, UserInputError } from 'apollo-server';
import { find, forEach } from 'lodash'
import crypto from 'crypto'
import { secret } from './token';
import { parsePhoneNumber } from '../utils'
import { string } from 'yup'
import moment from 'moment'

const RockGenderMap = {
    Unknown: 0,
    Male: 1,
    Female: 2,
};

export default class Auth extends coreAuth.dataSource {
    hashPassword = ({ passcode }) =>
        crypto
            .createHash('sha256')
            .update(`${passcode}${secret}`)
            .digest('hex')

    getUserLogin = (username) => this.request('/UserLogins')
        .filter(`UserName eq '${username}'`)
        .first()

    updateIdentityPassword = async ({ identity, passcode }) => {
        try {
            // encrypts the passcode passed in
            const password = this.hashPassword({ passcode })

            // looks for an existing user with the given identity
            const existingUserLogin = await this.getUserLogin(identity)

            // placeholder object for personOptions
            let personOptions = {}

            // Updating PlainTextPassword via Patch doesn't work, so we delete and recreate.
            if (existingUserLogin) {
                // if we have a PersonId on the user login, we should move it over to the new login.
                if (existingUserLogin.personId)
                    personOptions = { PersonId: existingUserLogin.personId }

                await this.delete(`/UserLogins/${existingUserLogin.id}`)
            }

            return this.post('/UserLogins', {
                EntityTypeId: 27, // A default setting we use in Rock-person-creation-flow
                UserName: identity,
                PlainTextPassword: password, // locally encrypted password
                IsConfirmed: true, // Rock locks some functionality when accounts are not confirmed
                ...personOptions, // { PersonId: ID } OR null
            })
        } catch (e) {
            console.log({ e })
        }
    }

    authenticateCredentials = async ({ identity, passcode }) => {
        // try parsing identity as a phone number
        const { valid, phoneNumber, e164 } = parsePhoneNumber({
            phoneNumber: identity,
        })

        // if valid phone number, set identity to the formatted number
        if (valid) identity = phoneNumber

        // find user login where username is equal to the identity passed in
        const userLogin = await this.getUserLogin(identity)

        // throw error if no username is found by that identity
        if (!userLogin) {
            throw new AuthenticationError('Invalid input');
        }

        // hash passcode passed in
        const password = this.hashPassword({ passcode })

        console.log("Authenticate Password:", { passcode, password })

        // return authenticated using identity and hashed password
        return this.context.dataSources.Auth.authenticate({
            identity,
            password
        })
    }

    requestSmsLogin = async ({ phoneNumber: phoneNumberInput }) => {
        // E.164 Regex that twilio recommends
        // https://www.twilio.com/docs/glossary/what-e164
        const { valid, phoneNumber, e164 } = parsePhoneNumber({
            phoneNumber: phoneNumberInput,
        })

        // throw error if invalid phone number was given
        if (!valid) {
            throw new UserInputError(`${phoneNumber} is not a valid phone number`);
        }

        // generates pin and password
        const pin = `${Math.floor(Math.random() * 1000000)}`.padStart(6, '0')

        // update or create new user login using phone number as identity and pin as passcode
        const user = await this.updateIdentityPassword({ identity: phoneNumber, passcode: pin })

        console.log({ user })

        // send sms with readable pin to the e164 formatted number
        await this.context.dataSources.Sms.sendSms({
            to: e164,
            body: `Your login code is ${pin}`,
        });

        console.log("Request SMS:", { pin })

        return { success: true }
    }

    // TODO : does this method need authenitcation of the identity and passcode before patching??
    relateUserLoginToPerson = async ({ identity, passcode, input }) => {
        const { id, createdDateTime } = await this.getUserLogin(identity)

        if (id) {
            try {
                // check the input oject for the required fields in order to post to People
                let errors = []
                let rockPersonFields = { // default person object with placeholder values
                    IsSystem: false, // Required by Rock
                    Gender: 0, // Required by Rock
                }
                const requiredFields = ['FirstName', 'LastName']
                const fieldsAsObject = this.context.dataSources.Person.reduceUpdateProfileInput(input)

                forEach(requiredFields, (field) => {
                    if (!fieldsAsObject[field]) errors.push(field)
                })

                if (errors.length) throw new UserInputError(`${errors.concat()} is required to relate a User Login to a Person`)

                // if gender is passed, update the gender key
                if (fieldsAsObject.Gender) {
                    fieldsAsObject.Gender = this.context.dataSources.Person.getGenderKey[fieldsAsObject.Gender];
                }

                // update our person object with the new field values
                rockPersonFields = {
                    ...rockPersonFields,
                    ...fieldsAsObject
                }

                // handle birthday parsing and update the person object
                if (fieldsAsObject.BirthDate) {
                    const birthDateObject = this.context.dataSources.Person.parseDateAsBirthday(fieldsAsObject.BirthDate)

                    rockPersonFields = {
                        ...rockPersonFields,
                        ...birthDateObject
                    };
                }

                // check to see if the identity passed is an email address
                if (await string().email().isValid(identity)) {
                    rockPersonFields = {
                        ...rockPersonFields,
                        Email: identity,
                        IsEmailActive: true
                    }
                }

                // post to People in Rock 
                // this endpoint handles duplicate checking and will either create or update an existing record
                // this post method returns the PersonId
                const personId = await this.post('/People', rockPersonFields)

                // determine if identity is a phone number
                if (!rockPersonFields.Email) {
                    await this.context.dataSources.PhoneNumber.addPhoneNumberToPerson({ personId, phoneNumber, countryCode })
                }

                // patch the user login to include the personId pulled from the above post to People
                await this.patch(`/UserLogins/${id}`, { PersonId })

                return { success: true, createdDateTime }
            } catch (e) {
                console.log({ e })
                return { success: false, createdDateTime }
            }
        }

        throw new Error(`No User Login found for the Identity: ${identity}`)

        return { success: false }
    }
}
