import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { createGlobalId, parseGlobalId } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

const resolver = {
    CheckInable: {
        __resolveType: ({ __typename }) => __typename,
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
        title: async ({ id, isCheckedIn }, args, { dataSources }) => {
            return isCheckedIn ? "Checked In" : "Check In"
        },
        message: ({ isCheckedIn }) => isCheckedIn ? "Thank you for checking in!" : "Let us know you're here",
        isCheckedIn: async ({ isCheckedIn }) => {
            const flag = get(ApollosConfig, 'FEATURE_FLAGS.CHECK_IN.status', null)

            if (!flag || flag !== 'LIVE') return false

            return isCheckedIn
        },
    },
    Mutation: {
        checkInCurrentUser: async (root, { id }, { dataSources }) => {
            const globalId = parseGlobalId(id)
            try {
                return dataSources.CheckInable.checkInCurrentUser(globalId.id)
            } catch (e) {
                console.log({ e })
            }

            return null
        },
    }
}

export default resolver
