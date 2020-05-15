import { AuthenticationError } from 'apollo-server';
import { Auth as CoreAuth } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash'

const { ROCK_MAPPINGS } = ApollosConfig

export default class AuthDataSource extends CoreAuth.dataSource {
    coreCreateUserProfile = this.createUserProfile

    createUserProfile = async (props) => {
        // In order to get Rock's duplicate record system
        //  to trigger, we need to mark the record as
        //  "pending" which is the status id: 5
        const personId = await this.coreCreateUserProfile({
            ...props,
            RecordStatusValueId: 5
        })

        this.context.dataSources.Person.updateFirstConnection(personId)

        return personId
    };

    requestEmailPin = async ({ email }) => {
        const { AuthSms, Workflow } = this.context.dataSources
        const { pin, password } = AuthSms.generateSmsPinAndPassword()

        try {
            const { id, personId } = await this.request('/UserLogins')
                .filter(`UserName eq '${email}'`)
                .first();

            if (id) {
                await this.delete(`/UserLogins/${id}`);
            }
            await this.createUserLogin({
                personId,
                email,
                password,
            });

            this.authenticate({
                identity: email,
                password,
            });



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
        const { AuthSms } = this.context.dataSources
        const hashedPin = AuthSms.hashPassword({ pin })

        try {
            await this.authenticate({ identity: email, password: hashedPin })
            return this.changePassword({ password: newPassword })
        } catch (e) {
            console.log({ e })
            return new AuthenticationError("The pin you entered was incorrect.")
        }
    }

    isInSecurityGroup = async (securityGroupId) => {
        try {
            // We need both a security group id as well a person id
            //  but there's no reason to request the current person
            //  if we don't have a security id. It's ugly, but it 
            //  works.
            if (!securityGroupId) return false

            const { id: personId } = await this.getCurrentPerson()

            if (!personId) return false

            const groupMembers = await this.request('/GroupMembers')
                .filter(`GroupId eq ${securityGroupId}`)
                .andFilter(`PersonId eq ${personId}`)
                .get()

            return groupMembers.length > 0
        } catch (e) {
            return false
        }

    }
}