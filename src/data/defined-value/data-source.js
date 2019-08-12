import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import { getIdentifierType } from '../utils'

export default class DefinedValue extends RockApolloDataSource {
    resource = 'DefinedValues'

    getDefinedValueByIdentifier = (id) => {
        const type = getIdentifierType(id)

        return type.query
            ? this.request().filter(type.query).first()
            : null
    }
}