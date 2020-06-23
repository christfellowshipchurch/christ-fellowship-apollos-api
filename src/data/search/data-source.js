import { dataSource as CoreSource } from '@apollosproject/data-connector-algolia-search'
import { graphql } from 'graphql';
import { take } from 'lodash'
import sanitizeHtml from 'sanitize-html';
import keywordExtractor from 'keyword-extractor'
import sizeof from 'object-sizeof'
import {
  createGlobalId,
} from '@apollosproject/server-core';

const MAX_SIZE = 10000 // bytes

const cleanHtmlContentForIndex = (htmlContent) => {
  // Strip all html tags
  const cleanedHtml = sanitizeHtml(htmlContent, {
    allowedTags: [],
    allowedAttributes: {}
  })

  return keywordExtractor.extract(cleanedHtml, {
    language: "english",
    remove_digits: true,
    return_changed_case: true,
    remove_duplicates: true
  })
}

const processObjectSize = (obj) => {
  const objSize = sizeof(obj)

  // If the object is smaller than the max size, return it
  if (objSize < MAX_SIZE) return obj

  // Calculate the size of the htmlContent and the rest of the props
  const htmlContentSize = sizeof(obj.htmlContent)
  const objPropSize = objSize - htmlContentSize

  if (objPropSize > MAX_SIZE) {
    // TODO : handle an object that exceeds the max size without any htmlContent
    return obj
  }

  // Calculate the max size that the html content array can be.
  const maxContentSize = MAX_SIZE - objPropSize
  // Calculate the new length of the array based on the % reduction
  // that needs to be had. It's not exact, but it should be decent 
  // enough for right now.
  //
  // Ex: if we need a 50% reduction in the array size, cut the array's
  // length in half
  const percentReduction = maxContentSize / htmlContentSize
  const newArrayLength = obj.htmlContent.length - (obj.htmlContent.length * percentReduction)

  return {
    ...obj,
    htmlContent: take(obj.htmlContent, newArrayLength)
  }
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

    return processObjectSize({
      ...data.node,
      htmlContent: cleanHtmlContentForIndex(data.node.htmlContent)
    });
  }
}