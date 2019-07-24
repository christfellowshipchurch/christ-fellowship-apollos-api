import { Auth as coreAuth } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'

const resolver = {
    Mutation: {
        requestSmsLoginPin: (root, { phoneNumber }, { dataSources }) =>
            dataSources.AuthSms.requestSmsLogin({ phoneNumber }),
        authenticateCredentials: (root, { identity, passcode }, { dataSources }) =>
            dataSources.Auth.authenticateCredentials({ identity, passcode }),
        updateUserLogin: (root, { identity, passcode }, { dataSources }) =>
            dataSources.Auth.updateIdentityPassword({ identity, passcode }),
        relateUserLoginToPerson: (root, { identity, passcode, input }, { dataSources }) =>
            dataSources.Auth.relateUserLoginToPerson({ identity, passcode, input }),
    }
}

export default resolverMerge(resolver, coreAuth)
