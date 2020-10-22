import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { createGlobalId, parseGlobalId } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

// TODO : - move to config.yml
const CHECK_IN_OPTION_MESSAGING = {
    31: {
        title: 'Ready to join your group?',
        message: "Check in to let your leader know you're here!",
    },
    37: {
        title: "Ready to serve?",
        message: "Select the times you will be serving today.",
    },
}

const resolver = {
    CheckInOption: {
        __resolveType: ({ __typename }) => __typename,
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
    },
    CheckInableNode: {
        __resolveType: ({ __typename, __type }, args, resolveInfo) =>
            __typename || resolveInfo.schema.getType(__type)
    },
    CheckInable: {
        __resolveType: ({ __typename }) => __typename,
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
        title: ({ groupTypeId }) =>
            get(CHECK_IN_OPTION_MESSAGING, `${groupTypeId}.title`, "We're so glad to see you!"),
        message: ({ groupTypeId }) =>
            get(CHECK_IN_OPTION_MESSAGING, `${groupTypeId}.message`, "Select the times that you're joining us."),
        isCheckedIn: async ({ isCheckedIn }) => {
            const flag = get(ApollosConfig, 'FEATURE_FLAGS.CHECK_IN.status', null)

            if (!flag || flag !== 'LIVE') return false

            return isCheckedIn
        },
        options: async (root, args, { dataSources }, { parentType }) => {
            const { CheckInable, Auth } = dataSources
            const currentUser = await Auth.getCurrentPerson()

            return CheckInable.getOptions(root, { personId: currentUser.id })
        }
    },
    Mutation: {
        checkInCurrentUser: async (root, { id, optionIds = [] }, { dataSources }) => {
            const groupId = parseGlobalId(id)
            const scheduleIds = optionIds
                .map(oid => get(parseGlobalId(oid), 'id'))
                .filter(oid => oid)
            try {
                return dataSources.CheckInable.checkInCurrentUser(
                    groupId.id,
                    { scheduleIds }
                )
            } catch (e) {
                console.log({ e })
            }

            return null
        },
    }
}

export default resolver
