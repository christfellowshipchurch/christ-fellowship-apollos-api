import * as coreSearch from '@apollosproject/data-connector-algolia-search'
import { resolverMerge } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config'

const { ROCK } = ApollosConfig

const resolver = {
    Mutation: {
        indexContentItem: (root, { id, key, action }, { dataSources }) => {
            if (id && action && key === ROCK.APOLLOS_SECRET) {
                const { Search } = dataSources
                switch (action) {
                    case "delete":
                        // TODO
                        return true
                    case "update":
                    default:
                        Search.updateContentItemIndex(id)
                        return true
                }
            }

            return false
        }
    }
}

export default resolverMerge(resolver, coreSearch)