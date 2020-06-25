import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import AwesomePhoneNumber from 'awesome-phonenumber'
import { UserInputError } from 'apollo-server'

const numberTypeValueIdMap = {
  mobile: 12
}

export default class PhoneNumber extends RockApolloDataSource {
  resource = 'PhoneNumbers'

  /*
  Parses a phone number passed into the method
  Uses Twilio's recommended format to validate the phone number
  
  https://www.twilio.com/docs/glossary/what-e164 */
  parsePhoneNumber = (phoneNumber) => {
    const number = new AwesomePhoneNumber(phoneNumber, 'US')

    return {
      valid: number.isValid(),
      phoneNumber: number.getNumber('significant'),
      numericOnlyPhoneNumber: number.isValid()
        ? number.getNumber('significant').replace(/[^0-9]/gi, '')
        : null,
      countryCode: AwesomePhoneNumber.getCountryCodeForRegionCode(
        number.getRegionCode()
      ),
      // "The international public telecommunication numbering plan", twilio likes numbers to be in this format.
      e164: number.getNumber('e164'),
    }
  }

  addPhoneNumberToPerson = async ({ personId, phoneNumber: phoneNumberInput, numberType = 'mobile' }) => {
    if (personId && phoneNumberInput) {
      const { valid, phoneNumber, countryCode } = this.parsePhoneNumber(phoneNumberInput)

      if (valid) {
        return this.post('/PhoneNumbers', {
          PersonId: personId,
          IsMessagingEnabled: true,
          IsSystem: false,
          Number: phoneNumber,
          CountryCode: countryCode,
          NumberTypeValueId: numberTypeValueIdMap[numberType]
        })
      }

      throw new UserInputError('Phone Number provided is invalid')
    }

    throw new Error('You must provide a Person Id and Phone Number to add a Phone Number')
  }

  getByUser = async () => {
    const currentPerson = await this.context.dataSources.Auth.getCurrentPerson()

    if (!currentPerson.id) throw new Error('Invalid credentials')

    return this.request()
      .filter(`(PersonId eq ${currentPerson.id}) and (NumberTypeValueId eq ${numberTypeValueIdMap.mobile})`)
      .first()
  }

  updateEnableSMS = async (allow) => {
    const phoneNumber = await this.getByUser()

    if (!phoneNumber.id) return { IsMessagingEnabled: false }

    return this.patch(`/PhoneNumbers/${phoneNumber.id}`, {
      IsMessagingEnabled: allow
    })
  }

  updateByUser = async (phoneNumber) => {
    const { valid, numericOnlyPhoneNumber } = this.parsePhoneNumber(phoneNumber)

    if (valid) {
      const { id } = await this.getByUser()

      return this.patch(`/PhoneNumbers/${id}`, {
        Number: numericOnlyPhoneNumber
      })
    }

    throw new Error('Phone Number passed is invalid')
  }
}