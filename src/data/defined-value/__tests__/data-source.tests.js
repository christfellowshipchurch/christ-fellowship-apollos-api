import ApollosConfig from '@apollosproject/config';
import DefinedValue from '../data-source';
import { buildGetMock } from '../../test-utils';

ApollosConfig.loadJs({
    ROCK: {
        API_URL: 'https://apollosrock.newspring.cc/api',
        API_TOKEN: 'some-rock-token',
        IMAGE_URL: 'https://apollosrock.newspring.cc/GetImage.ashx',
    },
});

describe('Defined Value', () => {
    // Parse Identifier parameter
    it('parses identifer as a guid', () => {
        const dataSource = new DefinedValue();
        const id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        const identifierType = dataSource.getIdentifierType(id);

        expect(identifierType).toEqual({ type: 'guid', value: id, query: `Guid eq (guid'${id}')` });
    });

    it('parses identifer as an integer', () => {
        const dataSource = new DefinedValue();
        const id = '999';
        const identifierType = dataSource.getIdentifierType(id);

        expect(identifierType).toEqual({ type: 'int', value: id, query: `Id eq ${id}` });
    });

    it('parses identifer as a custom identifer', () => {
        const dataSource = new DefinedValue();
        const id = 'some-custom-identifer';
        const identifierType = dataSource.getIdentifierType(id);
    });


    // Run the getValueBYBlablablablab
    it('gets a defined value from a valid guid or integer id', async () => {
        expect(dataSource.get.mocks).toMatchSnapshot();
        const id = '999'

        dataSource.get = jest.fn();

        const result = await dataSource.getDefinedValueByIdentifier(id);

        expect(dataSource.get.mocks).toMatchSnapshot();
    });

    it('returns null if no valid id or guid is passed', () => {
        const dataSource = new DefinedValue();
        const id = 'some-random-identifier'

        dataSource.get = jest.fn();

        const result = await dataSource.getDefinedValueByIdentifier(id);

        expect(dataSource.get.mocks).toMatchSnapshot();
        expect(result).toEqual(null);
    });
});