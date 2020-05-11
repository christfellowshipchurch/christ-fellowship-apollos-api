import { AuthenticationError } from 'apollo-server';
import { Auth as CoreAuth } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash'

const { ROCK_MAPPINGS } = ApollosConfig

export default class AuthDataSource extends CoreAuth.dataSource {
    coreCreateUserProfile = this.createUserProfile

    createUserProfile = async (props) => {
        const personId = await this.coreCreateUserProfile(props)

        this.context.dataSources.Person.updateFirstConnection(personId)

        return personId
    };

    requestEmailPin = async () => {
        const { AuthSms, Workflow } = this.context.dataSources
        const { pin, password } = AuthSms.generateSmsPinAndPassword()

        try {
            await this.changePassword({ password })

            const currentUser = await this.getCurrentPerson();
            const { email } = currentUser;

            Workflow.trigger({
                id: get(ROCK_MAPPINGS, 'WORKFLOW_IDS.PASSWORD_RESET_EMAIL'),
                attributes: {
                    email,
                    confirmationCode: pin
                }
            })
        } catch (e) {
            console.log({ e })
            return new AuthenticationError("There was an issue resetting your password. Please try again later.")
        }

    }

    changePasswordWithPin = async ({ email, pin, newPassword }) => {
        const { AuthSms, Workflow } = this.context.dataSources
        const hashedPin = AuthSms.hashPassword({ pin })

        try {
            await this.authenticate({ identity: email, password: hashedPin })
            return this.changePassword({ password: newPassword })
        } catch (e) {
            console.log({ e })
            return new AuthenticationError("The pin you entered was incorrect.")
        }
    }
}