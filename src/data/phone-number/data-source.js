import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import AwesomePhoneNumber from 'awesome-phonenumber'
import { UserInputError } from 'apollo-server';

export default class PhoneNumber extends RockApolloDataSource {
  resource = 'PhoneNumbers'

  /*
  Parses a phone number passed into the method
  Uses Twilio's recommended format to validate the phone number
  
  https://www.twilio.com/docs/glossary/what-e164 */
  parsePhoneNumber = ({ phoneNumber }) => {
    const number = new AwesomePhoneNumber(phoneNumber, 'US');

    return {
      valid: number.isValid(),
      phoneNumber: number.getNumber('significant'),
      countryCode: AwesomePhoneNumber.getCountryCodeForRegionCode(
        number.getRegionCode()
      ),
      // "The international public telecommunication numbering plan", twilio likes numbers to be in this format.
      e164: number.getNumber('e164'),
    };
  };

  addPhoneNumberToPerson = async ({ personId, phoneNumber }) => {
    if (personId && phoneNumber) {
      const { valid, phoneNumber, countryCode } = this.parsePhoneNumber({ phoneNumber })

      if (valid) {
        return this.post('/PhoneNumbers', {
          PersonId: personId,
          IsMessagingEnabled: true,
          IsSystem: false,
          Number: phoneNumber,
          CountryCode: countryCode,
          NumberTypeValueId: 12, // 12 is a Constant Set in Rock, means "Mobile"
        })
      }

      throw new UserInputError('Phone Number provided is invalid')
    }

    throw new Error('You must provide a Person Id and Phone Number to add a Phone Number')
  }
}