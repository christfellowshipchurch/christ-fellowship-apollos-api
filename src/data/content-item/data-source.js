import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { Utils } from '@apollosproject/data-connector-rock'

const { createImageUrlFromGuid } = Utils

export default class ContentItem extends coreContentItem.dataSource {
    getImages = ({ attributeValues, attributes }) => {
        let images = [{
            __typename: 'ImageMedia',
            key: '',
            name: '',
            sources: [{ uri: 'https://picsum.photos/640/640/?random' }],
        }]
        const imageKeys = Object.keys(attributes).filter((key) =>
            this.attributeIsImage({
                key,
                attributeValues,
                attributes,
            })
        )

        if (imageKeys.length) {

            console.log({ imageKeys })
            images = imageKeys.map((key) => ({
                __typename: 'ImageMedia',
                key,
                name: attributes[key].name,
                sources: attributeValues[key].value
                    ? [{ uri: createImageUrlFromGuid(attributeValues[key].value) }]
                    : [{ uri: 'https://picsum.photos/640/640/?random' }],
            }))
        }

        return images
    }
}