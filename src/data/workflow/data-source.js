import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import {
    get,
    has,
    forEach,
    camelCase,
    replace,
    snakeCase,
    upperFirst
} from 'lodash'

export default class Workflow extends RockApolloDataSource {
    capitalizeAttributes = (attributes) => {
        let rtnAttrs = {}

        forEach(attributes, (n, i) => rtnAttrs[upperFirst(camelCase(i))] = n)

        return rtnAttrs
    }

    trigger = ({ id, attributes }) => {
        if (id && attributes) {
            let ampersand = ''
            let queryString = ''

            forEach(this.capitalizeAttributes(attributes), (n, i) => {
                queryString = `${queryString}${ampersand}${i}=${n}`
                ampersand = '&'
            })

            return this.post(
                `/Workflows/WorkflowEntry/${id}?${queryString}`
            )
        }

        return null
    }

}
