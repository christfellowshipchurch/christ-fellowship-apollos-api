import { Auth as coreAuth } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
    Mutation: {
        requestSmsLoginPin: (root, { phoneNumber }, { dataSources }) =>
            dataSources.AuthSms.requestSmsLogin({ phoneNumber }),
        requestEmailLoginPin: (root, { email }, { dataSources }) =>
            dataSources.Auth.requestEmailPin({ email }),
        authenticateCredentials: (root, { identity, passcode }, { dataSources }) =>
            dataSources.Auth.authenticateCredentials({ identity, passcode }),
        relateUserLoginToPerson: (root, { identity, passcode, input }, { dataSources }) =>
            dataSources.Auth.relateUserLoginToPerson({ identity, passcode, input }),
        createNewUserLogin: async (root, { identity, passcode }, { dataSources }) => {
            const { success, isExistingIdentity } = await dataSources.Auth.updateIdentityPassword({ identity, passcode })

            if (success) {
                return dataSources.Auth.authenticateCredentials({ identity, passcode })
            }

            throw new Error("Unable to create User Login:", { identity, passcode })
        },
        isValidIdentity: async (root, { identity }, { dataSources }) => {
            const userLogin = await dataSources.Auth.getUserLogin(identity)

            return userLogin
                ? { success: true, isExistingIdentity: true }
                : { success: true, isExistingIdentity: false }
        },
        requestPasswordChange: (root, { identity, passcode, newPasscode }, { dataSources }) =>
            dataSources.Auth.changeEmailPassword({ identity, passcode, newPasscode }),
    },
    Query: {
        getUserLoginTypes: (root, props, { dataSources }) =>
            dataSources.Auth.getUserLoginTypes(),
    }
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default resolverMerge(resolver, coreAuth)
