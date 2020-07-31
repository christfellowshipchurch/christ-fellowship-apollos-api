import { Feature } from '@apollosproject/data-connector-rock'
import ApollosConfig from '@apollosproject/config'
import { get, dropRight, last, first, mapValues, flatten } from 'lodash'
import URL from 'url';

import { getIdentifierType } from '../utils'

const { PAGE_BUILDER } = ApollosConfig

export default class PageBuilder extends Feature.dataSource {

    getFromId = this.getFromId
    createPageBuilderFeatureId = this.createFeatureId

    // Names of Action Algoritms mapping to the functions that create the actions.
    ACTION_ALGORITHIMS = Object.entries({
        MATRIX_ITEMS: this.matrixItemsFromContentChannelItemAlgorithm,
        CAMPUS_META: this.campusMetaFromContentChannelItemAlgorithm,
    }).reduce((accum, [key, value]) => {
        // convenciance code to make sure all methods are bound to the PageBuilder dataSource
        // eslint-disable-next-line
        accum[key] = value.bind(this);
        return accum;
    }, {});

    async createContentGridFeature({
        algorithms = [],
        title,
        subtitle,
        primaryAction
    }) {
        const blocks = () => this.runAlgorithms({ algorithms });
        return {
            // The Feature ID is based on all of the action ids, added together.
            // This is naive, and could be improved.
            id: this.createFeatureId({
                type: 'ContentGridFeature',
                args: {
                    algorithms,
                    title,
                    subtitle,
                    primaryAction
                },
            }),
            blocks,
            title,
            subtitle,
            // Typename is required so GQL knows specifically what Feature is being created
            __typename: 'ContentGridFeature',
        };
    }

    async matrixItemsFromContentChannelItemAlgorithm({ attributeKey, contentChannelItem }) {
        const { MatrixItem } = this.context.dataSources
        const matrixAttributeValue = get(contentChannelItem, `attributeValues.${attributeKey}.value`)

        const items = await MatrixItem.getItemsFromId(matrixAttributeValue)
        const attributeValues = items.map(item => item.attributeValues)

        return attributeValues.map(attribute => mapValues(attribute, o => o.value))
    }

    async campusMetaFromContentChannelItemAlgorithm({ attributeKey, contentChannelItem }) {
        // PRE FORMAT ALL CONTENT
        // Assumes attributeKey represents a Campus Id
        const { Campus } = this.context.dataSources
        const campusIdAttributeValue = get(contentChannelItem, `attributeValues.${attributeKey}.value`)

        const items = await Campus.getFromId(campusIdAttributeValue)

        // TODO : get the campus image, description, and 

        const description = `Christ Fellowship Church in ${city}. Led by ${campus - pastor} and Todd and Julie Mullins. We meet every ${days - of - week} for a time of worship and teaching from the Bible.`

        // MANUALLY CREATED META TAGS
        // Assumes attributeKey represents a Defined Value Id (for meta tags)
        const { DefinedValue, Metadata } = this.context.dataSources

        const definedValue = {} // get defined value
        return Metadata.parseDefinedValue(definedValue)

        // map the defined value to an array of [ { name, content } ]

        return [
            { name: "description", content: "my description" },
            { name: "keywords", content: "My,Keywords" }
        ]
    }

    async createContentBlockFeature({
        contentChannelItem,
        fields = ['title', 'content', 'image'],
        display,
    }) {
        const { ContentItem } = this.context.dataSources
        let content = {}

        /** Check the Content Channel Item for the fields that we are looking to
         *  pass back into this specific ContentBlockFeature
         */
        fields.forEach(field => content[field] = get(contentChannelItem, field))

        /** Image is not a field inside of the Content Channel Item that we can
         *  super easily reference, so we'll just need to manually check for that
         *  field and then run the `getCoverImage` method from the ContentItem dataSource
         */
        const image = fields.includes('image')
            ? await ContentItem.getCoverImage(contentChannelItem)
            : null

        return {
            id: this.createPageBuilderFeatureId({
                type: 'ContentBlockFeature',
                args: {
                    contentChannelItemId: contentChannelItem.id,
                    ...content
                },
            }),
            content: {
                ...content,
                image
            },
            display,
            __typename: "ContentBlockFeature"
        }
    }

    async createContentGridFeature({
        algorithms,
        contentChannelItem,
        primaryAction,
        title,
        subtitle,
    }) {
        const blocks = () => this.runAlgorithms({
            algorithms: algorithms.map(a => ({
                ...a,
                arguments: {
                    ...a.arguments,
                    contentChannelItem
                }
            }))
        });

        return {
            id: this.createPageBuilderFeatureId({
                type: 'ContentGridFeature',
                args: {
                    contentChannelItemId: contentChannelItem.id,
                    algorithms,
                    primaryAction
                },
            }),
            title,
            subtitle,
            blocks,
            primaryAction,
            __typename: "ContentGridFeature"
        }
    }

    async createCampusContentFeature({
        contentChannelItem,
        action,
        attributeKey
    }) {
        const { Campus } = this.context.dataSources
        const campusAttributeValue = get(contentChannelItem, `attributeValues.${attributeKey}.value`)
        const campus = Campus.getFromId(campusAttributeValue)

        return {
            id: this.createPageBuilderFeatureId({
                type: 'CampusContentFeature',
                args: {
                    contentChannelItemId: contentChannelItem.id,
                    action,
                    attributeKey
                },
            }),
            action,
            campus,
            __typename: "CampusContentFeature"
        }
    }

    async createMetadataFeature({
        contentChannelItem,
        algorithms
    }) {

        const meta = () => this.runAlgorithms({
            algorithms: algorithms.map(a => ({
                ...a,
                arguments: {
                    ...a.arguments,
                    contentChannelItem
                }
            }))
        });

        const definedValueGuid = get(contentChannelItem, 'attributeValues.metadata.value')
        if (definedValueGuid && definedValueGuid !== '') {
            const definedValue = await this.context.dataSources.DefinedValue.getByIdentifier(definedValueGuid)
            const metadata = this.context.dataSources.Metadata.parseDefinedValue(definedValue)
            console.log(metadata)
            return metadata
        }


        return {
            id: this.createPageBuilderFeatureId({
                type: 'MetadataFeature',
                args: {
                    contentChannelItemId: contentChannelItem.id,
                    algorithms
                },
            }),
            meta: metadata,
            __typename: "MetadataFeature"
        }
    }

    async buildForUrl(url) {
        /** Parse the URL and get the pathname */
        const parsedUrl = URL.parse(url)
        const { pathname } = parsedUrl
        /** Split the pathname by the / so that we can get the page that we want to query
         *  as well as the path to the config object for that path to get the Content Channel
         *  where those pages live.
         * 
         *  Example: '/locations/name/' should resolve to ['locations', 'name'] so that we can
         *           check the PAGE_BUILDER config object for the Content Channel Id for 'locations'
         *           and then query that Content Channel for 'name'
         */
        const paths = pathname.split('/').filter(path => path && path !== "")
        const pathToPage = dropRight(paths)
        const page = last(paths)
        const configuration = get(PAGE_BUILDER, `${pathToPage.join('.')}`, {})

        if (configuration.contentChannelId) {
            /** Get the name of the attribute that we want to use to query for pages for
             *  this specific configuration
             *  
             *  Create the request URL and then get the first result of the return value
             *  since Rock returns to us an array of objects.
             * 
             *  TODO : figure out a more mature way of handling what happens when more than 1
             *          content item is returned
             */
            const { contentChannelId } = configuration
            const requestBase = 'ContentChannelItems/GetByAttributeValue'
            const attributeKey = get(configuration, 'queryAttribute', 'url')
            const contentChannelItems = await this.request(`${requestBase}?attributeKey=${attributeKey}&value=${page}&loadAttributes=expanded`)
                .filter(`ContentChannelId eq ${contentChannelId}`)
                .get()
            const contentChannelItem = first(contentChannelItems)

            if (configuration.buildingBlocks) {
                return Promise.all(configuration.buildingBlocks.map(blockConfig => {
                    const configWithContentChannelItem = { ...blockConfig, contentChannelItem }
                    switch (configWithContentChannelItem.type) {
                        case "MetadataFeature":
                            return this.createMetadataFeature(configWithContentChannelItem)
                        case "ContentGridFeature":
                            return this.createContentGridFeature(configWithContentChannelItem)
                        case "CampusContentFeature":
                            return this.createCampusContentFeature(configWithContentChannelItem)
                        case "ContentBlockFeature":
                        default:
                            return this.createContentBlockFeature(configWithContentChannelItem)
                    }
                }))
            }
        }
    }

}