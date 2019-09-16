import ApollosConfig from '@apollosproject/config'
import DefinedValueList from '../data-source'

ApollosConfig.loadJs({
    ROCK: {
        API_URL: 'https://apollosrock.newspring.cc/api',
        API_TOKEN: 'some-rock-token',
        IMAGE_URL: 'https://apollosrock.newspring.cc/GetImage.ashx',
    },
})

describe('Defined Value List', () => {
    it('gets a defined value from a valid guid or integer id', async () => {
        const dataSource = new DefinedValueList()
        const id = '999'

        dataSource.get = jest.fn(() => Promise.resolve([{ Id: 999, Value: 'Foo' }]))

        const result = dataSource.getByIdentifier(id)

        expect(result).toMatchSnapshot()
    })
})