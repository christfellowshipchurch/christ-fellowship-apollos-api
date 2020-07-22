import { get } from 'lodash';

export default {
    PageBuilderFeature: {
        // Implementors must attach __typename to root.
        __resolveType: ({ __typename }) => __typename,
    },
    ContentBlockItem: {
        htmlContent: ({ content }) => content
    },
    Query: {
        pageBuilderFeatures: (root, { url }, { dataSources: { PageBuilder } }) =>
            PageBuilder.buildForUrl(url),
    },
};
