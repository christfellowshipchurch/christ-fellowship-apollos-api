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
        if (id && id !== "") {
            try {
                const definedValue = await this.getByIdentifier(id)

                return definedValue.value
            } catch (e) {
                console.log(`Error requesting Defined Value of Id: ${id}`, { e })
            }
        }

        return null
    }
}