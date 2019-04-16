import ApollosConfig from '@apollosproject/config';
import WebsitePagesContentItem from '../data-source';
import { buildGetMock } from '../../test-utils'

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
const title = 'hello-there'

describe('Website Pages Content Item', () => {
    // Test the normalizeSlug method
    it('returns a lowercase string with no spaces', () => {
        const dataSource = new WebsitePagesContentItem()
        const testCases = [
            { pass: 'Hello There', expect: 'hellothere' },
            { pass: 'Hello-There', expect: 'hello-there' }
        ]

        testCases.forEach(n => {
            const normalize = dataSource.normalizeSlug(n.pass)
            expect(normalize).toEqual(n.expect)
        })
    })

    // Test calls to the Content Channel Item Slugs table
    it('makes a call to ContentChannelItemSlugs where Slug is equal to the noramlized title passed in', async () => {
        const dataSource = new WebsitePagesContentItem()

        dataSource.get = jest.fn(() => Promise.resolve([{ ContentChannelItemId: 1, Slug: title }]))

        const result = await dataSource.getContentChannelIdByTitle(title)

        expect(dataSource.get.mock.calls).toMatchSnapshot()
    })

    it('makes a call to ContentChannelItemSlugs where Slug is not found and returns null', async () => {
        const dataSource = new WebsitePagesContentItem()

        dataSource.get = jest.fn(() => Promise.resolve([]))

        const result = await dataSource.getContentChannelIdByTitle(title)

        expect(result).toEqual(null)
    })

    // Test the possible return values when getting page content
    it('does not find slug for the title passed and returns null', async () => {
        const dataSource = new WebsitePagesContentItem()

        dataSource.getContentChannelIdByTitle = jest.fn(() => null)

        const result = await dataSource.getWebsitePageContentByTitle(website, title)

        expect(result).toEqual(null)
    })

    it('does not find a Content Channel Id for the website passed and returns null', async () => {
        const dataSource = new WebsitePagesContentItem()

        dataSource.get = jest.fn(() => Promise.resolve([{ ContentChannelItemId: 1, Slug: title }]))

        const result = await dataSource.getWebsitePageContentByTitle('NOT_THE_RIGHT_WEBSITE', title)

        expect(result).toEqual(null)
    })

    it('gets a Website Page Content Item from passing in a website key and page title', async () => {
        const dataSource = new WebsitePagesContentItem()

        dataSource.get = buildGetMock([
            [{ ContentChannelItemId: 1, Slug: title }],
            [{ Id: 1, ContentChannelId: 10 }]
        ], dataSource)

        const result = await dataSource.getWebsitePageContentByTitle(website, title)

        expect(dataSource.get.mock.calls).toMatchSnapshot();
    })
});