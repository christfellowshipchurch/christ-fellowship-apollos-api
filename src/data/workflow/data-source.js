import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import {
    get,
    has,
    forEach,
    camelCase,
    replace,
    snakeCase,
    upperFirst,
    mapValues
} from 'lodash'

export default class Workflow extends RockApolloDataSource {
    capitalizeAttributes = (attributes) => {
        let rtnAttrs = {}

        forEach(attributes, (n, i) => rtnAttrs[upperFirst(camelCase(i))] = n)

        return rtnAttrs
    }

    trigger = async ({ id, attributes }) => {
        if (id && attributes) {
            let ampersand = ''
            let queryString = ''

            forEach(this.capitalizeAttributes(attributes), (n, i) => {
                queryString = `${queryString}${ampersand}${i}=${n}`
                ampersand = '&'
            })

            console.log({ id, queryString })

            const workflowResponse = await this.post(
                `/Workflows/WorkflowEntry/${id}?${queryString}`
            )

            const attributeValues = get(workflowResponse, 'attributeValues', {})

            return {
                status: get(workflowResponse, 'status', 'Failed'),
                attributes: mapValues(attributeValues, (n) => get(n, 'value', ''))
            }
        }

        return null
    }

}
