import {
    Auth as coreAuth,
} from '@apollosproject/data-connector-rock'
import { AuthenticationError, UserInputError } from 'apollo-server';
import { find, forEach, head } from 'lodash'
import crypto from 'crypto'
import { secret } from './token';
import { string } from 'yup'

const DEFAULT_ROCK_APOLLOS_PERSON_ID = 360207

export default class Auth extends coreAuth.dataSource {
    // global flag to be accessed to keep state of whether a user login is pre-existing or new
    // TODO : propose that UserLogins have the ability to have passwords updated without deleting so we can accomplish this using createDateTime
    isExistingUserLogin = false

    parseIdentityAsPhoneNumber = (identity) => {
        // try parsing identity as a phone number
        const { valid, phoneNumber, e164, numericOnlyPhoneNumber } = this.context.dataSources.PhoneNumber.parsePhoneNumber(identity)

        // if valid phone number, set identity to the formatted number with no special characters
        if (valid) return numericOnlyPhoneNumber

        return identity
    }

    hashPassword = ({ passcode }) =>
        crypto
            .createHash('sha256')
            .update(`${passcode}${secret}`)
            .digest('hex')

    getUserLogin = (identity) => this.request('/UserLogins')
        .filter(`UserName eq '${identity}'`)
        .first()

    updateIdentityPassword = async ({ identity, passcode }) => {
        // reset existing user login flag
        this.isExistingUserLogin = false

        try {
            // encrypts the passcode passed in
            const password = this.hashPassword({ passcode })

            // looks for an existing user with the given identity
            const existingUserLogin = await this.getUserLogin(identity)

            // placeholder object for personOptions
            let personOptions = { PersonId: DEFAULT_ROCK_APOLLOS_PERSON_ID }

            // Updating PlainTextPassword via Patch doesn't work, so we delete and recreate.
            if (existingUserLogin) {
                this.isExistingUserLogin = true
                // if we have a PersonId on the user login, we should move it over to the new login.
                if (existingUserLogin.personId)
                    personOptions = { PersonId: existingUserLogin.personId }

                console.log("Deleting User Login")
                await this.delete(`/UserLogins/${existingUserLogin.id}`)
            }

            const userLogin = await this.post('/UserLogins', {
                EntityTypeId: 27, // A default setting we use in Rock-person-creation-flow
                UserName: identity,
                PlainTextPassword: password, // locally encrypted password
                IsConfirmed: true, // Rock locks some functionality when accounts are not confirmed
                ...personOptions, // { PersonId: ID } OR null
            })

            if (userLogin) return { success: true, isExistingIdentity: this.isExistingUserLogin }

            return { success: false, isExistingIdentity: this.isExistingUserLogin }
        } catch (e) {
            console.log({ e })

            return { success: false, isExistingIdentity: this.isExistingUserLogin }
        }
    }

    authenticateCredentials = async ({ identity, passcode }) => {
        // try parsing identity as a phone number
        identity = this.parseIdentityAsPhoneNumber(identity)

        // find user login where username is equal to the identity passed in
        const userLogin = await this.request('/UserLogins')
            .filter(`UserName eq '${identity}'`)
            .get()

        // throw error if no username is found by that identity
        if (!userLogin) {
            throw new AuthenticationError('Invalid input')
        }
        console.log("ln:83")
        // hash passcode passed in
        const password = this.hashPassword({ passcode })

        console.log("ln:87", { identity, password })

        // return authenticated using identity and hashed password
        return this.context.dataSources.Auth.authenticate({
            identity,
            password
        })
    }

    requestSmsLogin = async ({ phoneNumber: phoneNumberInput }) => {
        // E.164 Regex that twilio recommends
        // https://www.twilio.com/docs/glossary/what-e164
        const { valid, phoneNumber, e164, numericOnlyPhoneNumber } = this.context.dataSources.PhoneNumber.parsePhoneNumber(phoneNumberInput)

        // throw error if invalid phone number was given
        if (!valid) {
            throw new UserInputError(`${phoneNumber} is not a valid phone number`);
        }

        // generates pin and password
        const pin = `${Math.floor(Math.random() * 1000000)}`.padStart(6, '0')

        // update or create new user login using phone number as identity and pin as passcode
        const user = await this.updateIdentityPassword({ identity: numericOnlyPhoneNumber, passcode: pin })

        console.log({ user })

        // send sms with readable pin to the e164 formatted number
        await this.context.dataSources.Sms.sendSms({
            to: e164,
            body: `Your login code is ${pin}`,
        });

        console.log("Request SMS:", { pin })

        return { success: true, isExistingIdentity: this.isExistingUserLogin }
    }

    // TODO : does this method need authenitcation of the identity and passcode before patching??
    relateUserLoginToPerson = async ({ identity, passcode, input }) => {
        // try parsing identity as a phone number
        identity = this.parseIdentityAsPhoneNumber(identity)
        
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
                    fieldsAsObject.Gender = this.context.dataSources.Person.getGenderKey(fieldsAsObject.Gender)
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
                    const { valid, phoneNumber } = this.context.dataSources.PhoneNumber.parsePhoneNumber(identity)

                    if (valid)
                        await this.context.dataSources.PhoneNumber.addPhoneNumberToPerson({ personId, phoneNumber })
                }

                // patch the user login to include the personId pulled from the above post to People
                console.log("User Logins", { id, personId })
                await this.patch(`/UserLogins/${id}`, { PersonId: personId })

            } catch (e) {
                console.log({ e })
            }

            return this.authenticateCredentials({ identity, passcode })
        }

        throw new Error(`No User Login found for the Identity: ${identity}`)
    }
}
