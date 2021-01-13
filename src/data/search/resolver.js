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
                        return `⚠️ Action 'delete' not implemented | id: ${id} | key: ${key} | action: ${action}`
                    case "update":
                    default:
                        Search.updateContentItemIndex(id)
                        return `Successfully updated | id: ${id} | key: ${key} | action: ${action}`
                }
            }

            return `Failed to update | id: ${id} | key: ${key} | action: ${action}`
        }
    }
}

export default resolverMerge(resolver, coreSearch)