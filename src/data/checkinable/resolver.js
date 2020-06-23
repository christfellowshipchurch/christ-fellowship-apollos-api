import { Person as corePerson } from '@apollosproject/data-connector-rock'
import { createGlobalId } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

const resolver = {
    CheckInable: {
        __resolveType: ({ __typename }) => __typename,
        id: ({ id }, args, context, { parentType }) =>
            createGlobalId(id, parentType.name),
    },
}

export default resolver
