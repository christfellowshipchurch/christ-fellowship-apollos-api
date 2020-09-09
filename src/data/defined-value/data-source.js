import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import { getIdentifierType } from '../utils'

export default class DefinedValue extends RockApolloDataSource {
    resource = 'DefinedValues'
    expanded = true

    getDefinedValueByIdentifier = (id) => this.getByIdentifier(id)
    getByIdentifier = (id) => {
        const type = getIdentifierType(id)

        return type.query
            ? this.request().filter(type.query).first()
            : null
    }

    getValueById = async (id) => {
        const definedValue = await this.getByIdentifier(id)

        return definedValue.value
    }
}