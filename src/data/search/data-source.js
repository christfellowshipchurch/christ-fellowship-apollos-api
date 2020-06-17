import { dataSource as CoreSource } from '@apollosproject/data-connector-algolia-search'
import { graphql } from 'graphql';
import removeWords from 'remove-words';
import sanitizeHtml from 'sanitize-html';
import {
  createGlobalId,
} from '@apollosproject/server-core';

const cleanHtmlContentForIndex = (htmlContent) => {
  // Strip all html tags
  const cleanedHtml = sanitizeHtml(htmlContent, {
    allowedTags: [],
    allowedAttributes: {}
  })

  // REmove unneeded words (ie: a, the, them, etc.)
  const words = removeWords(cleanedHtml, false)

  return words
}

export default class Search extends CoreSource {

  async mapItemToAlgolia(item) {
    const { ContentItem } = this.context.dataSources;
    const type = await ContentItem.resolveType(item);

    const { data } = await graphql(
      this.context.schema,
      `query getItem {
        node(id: "${createGlobalId(item.id, type)}") {
          ... on ContentItem {
            id
            title
            summary
            htmlContent
            objectID: id
            __typename
            coverImage { sources { uri } }
          }
        }
      }`,
      {},
      this.context
    );

    return {
      ...data.node,
      htmlContent: cleanHtmlContentForIndex(data.node.htmlContent)
    };
  }
}