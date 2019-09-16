import ApollosConfig from '@apollosproject/config'
import DefinedValue from '../data-source'

ApollosConfig.loadJs({
    ROCK: {
        API_URL: 'https://apollosrock.newspring.cc/api',
        API_TOKEN: 'some-rock-token',
        IMAGE_URL: 'https://apollosrock.newspring.cc/GetImage.ashx',
    },
})

describe('Defined Value', () => {
    // getByIdentifier
    it('gets a defined value from a valid integer id', async () => {
        const dataSource = new DefinedValue()
        const id = '999'

        dataSource.get = jest.fn(() => Promise.resolve([{ Id: 999, Value: 'Foo' }]))

        const result = dataSource.getByIdentifier(id)

        expect(result).toMatchSnapshot()
    })

    it('gets a defined value from a valid guid', async () => {
        const dataSource = new DefinedValue()
        const id = '967d2b2c-1d2a-474f-bc6e-9278443b3d6a'

        dataSource.get = jest.fn(() => Promise.resolve([{ Guid: '967d2b2c-1d2a-474f-bc6e-9278443b3d6a', Value: 'Foo' }]))

        const result = dataSource.getByIdentifier(id)

        expect(result).toMatchSnapshot()
    })

    it('gets a defined value from a custom id', async () => {
        const dataSource = new DefinedValue()
        const id = 'custom-id'

        dataSource.get = jest.fn(() => Promise.resolve([{ CustomId: 'custom-id', Value: 'Foo' }]))

        const result = dataSource.getByIdentifier(id)

        expect(result).toMatchSnapshot()
    })

    it('returns null if no valid id or guid is passed', async () => {
        const dataSource = new DefinedValue()
        const id = 'some-random-identifier'

        dataSource.get = jest.fn(() => Promise.resolve([{ Id: 999, Value: 'Foo' }]))

        const result = await dataSource.getByIdentifier(id)

        expect(result).toEqual(null)
    })

    // DEPRECATED : getDefinedTypeByIdentifier
    it('checks to make sure the deprecated method, getDefinedValueByIdentifier, is still supported', async () => {
        const dataSource = new DefinedValue()
        const id = '999'

        dataSource.get = jest.fn(() => Promise.resolve([{ Id: 999, Value: 'Foo' }]))

        const result = dataSource.getDefinedValueByIdentifier(id)

        expect(result).toMatchSnapshot()
    })
})