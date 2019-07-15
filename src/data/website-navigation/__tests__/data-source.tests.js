import ApollosConfig from '@apollosproject/config';
import WebsiteNavigation from '../data-source';

ApollosConfig.loadJs({
    ROCK: {
        API_URL: 'https://apollosrock.newspring.cc/api',
        API_TOKEN: 'some-rock-token',
        IMAGE_URL: 'https://apollosrock.newspring.cc/GetImage.ashx',
    },
    ROCK_MAPPINGS: {
        WEBSITE_CONTENT_CHANNEL_IDS: {
            TEST_SITE: [1]
        }
    }
})

const website = 'TEST_SITE'

describe('Website Navigation', () => {
    // Test getWebsiteNavigation
    it('requests the website navigation based on a website key', async () => {
        const dataSource = new WebsiteNavigation()

        dataSource.get = jest.fn(() => Promise.resolve([]))

        const result = await dataSource.getWebsiteNavigation(website)

        expect(dataSource.get.mock.calls).toMatchSnapshot()
    })

    it('requests the website navigation for a key that does not exist and returns null', async () => {
        const dataSource = new WebsiteNavigation()

        dataSource.get = jest.fn(() => Promise.resolve([]))

        const result = await dataSource.getWebsiteNavigation('INVALID_WEBSITE')

        expect(result).toBe(null)
    })
});