import { dataSource as CoreSource } from '@apollosproject/data-connector-algolia-search'
import { graphql } from 'graphql';
import removeWords from 'remove-words';
import sanitizeHtml from 'sanitize-html';
import { keys } from 'lodash'

const cleanHtmlContentForIndex = (htmlContent) => {
  const cleanedHtml = sanitizeHtml(data.node.htmlContent, {
    allowedTags: [],
    allowedAttributes: {}
  })
  const words = removeWords(cleanedHtml, false)
  const wordCounts = {};

  for (var i = 0; i < words.length; i++)
    wordCounts["_" + words[i]] = (wordCounts["_" + words[i].replace(' ', '')] || 0) + 1;

  return keys(wordCounts)
    .sort((a, b) => wordCounts[b] - wordCounts[a])
    .map(w => w.replace('_', ''))
    .join(' ')
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