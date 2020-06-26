import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'
import { currentUserCanUseFeature } from '.'

const resolver = {
    Query: {
        flagStatus: (root, { key }, { dataSources }) =>
            currentUserCanUseFeature(key)
    }
}

export default resolver
