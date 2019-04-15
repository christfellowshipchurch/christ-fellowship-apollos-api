import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

export default class DefinedValue extends RockApolloDataSource {
    resource = 'DefinedValues';

    // TODO : move to utils
    getIdentifierType = (identifier) => {
        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const intRegex = /\D/g;

        if (identifier.match(guidRegex)) {
            return { type: 'guid', value: identifier, query: `Guid eq (guid'${identifier}')` };
        } else if (!identifier.match(intRegex)) {
            return { type: 'int', value: identifier, query: `Id eq ${identifier}` };
        }

        return { type: 'custom', value: identifier, query: null };
    }

    getDefinedValueByIdentifier = (id) => {
        const type = this.getIdentifierType(id);

        return type.query
            ? this.request().filter(type.query).first()
            : null;
    }
};