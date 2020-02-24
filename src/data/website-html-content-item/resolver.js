import { ContentItem } from '@apollosproject/data-connector-rock'

const resolver = {
    WebsiteHtmlBlockItem: {
        htmlContent: ({ content }) => content
    }
}

export default resolver