import ApollosConfig from '@apollosproject/config';
import DefinedValue from '../data-source';

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
        const id = 'f6bc95f5-057b-4313-8946-75381d7c5129';
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
        const dataSource = new DefinedValue();
        const id = '999'

        dataSource.get = jest.fn(() => Promise.resolve([{ Id: 999, Value: 'Foo' }]));

        const result = dataSource.getDefinedValueByIdentifier(id);

        expect(dataSource.get.mocks).toMatchSnapshot();
    });

    it('returns null if no valid id or guid is passed', async () => {
        const dataSource = new DefinedValue();
        const id = 'some-random-identifier'
        const result = await dataSource.getDefinedValueByIdentifier(id);

        expect(dataSource.get.mocks).toMatchSnapshot();
        expect(result).toEqual(null);
    });
});