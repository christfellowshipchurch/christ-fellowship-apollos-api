import { dataSource as CoreDataSource } from '@apollosproject/data-connector-algolia-search';
import { createGlobalId } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config'
import { graphql } from 'graphql';
import { take, get } from 'lodash';
import sanitizeHtml from 'sanitize-html';
import keywordExtractor from 'keyword-extractor';
import sizeof from 'object-sizeof';
import momentTz from 'moment-timezone'

const { ROCK } = ApollosConfig

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

export default class Search extends CoreDataSource {

  async indexAllGeneralContent() {
    const { ContentItem } = this.context.dataSources

    const contentItems = await ContentItem
      .request()
      .filterOneOf([43, 45, 60, 63].map(n => `ContentChannelId eq ${n}`))
      .andFilter(ContentItem.byActive())
      .get()

    const indexableItems = await Promise.all(
      contentItems.map((item) => this.mapItemToAlgolia(item))
    );

    this.addObjects(indexableItems);
  }

  async updateContentItemIndex(id) {
    // Resolve the Content Item
    const { ContentItem } = this.context.dataSources
    const item = await ContentItem.getFromId(id)
    const hideFromSearch = get(item, "attributeValues.hideFromSearch.value", "false").toLowerCase()

    if (hideFromSearch === "true") { // Delete the item if it should not be included in Search
      const type = await this.resolveContentItem(item);
      return this.index.deleteObject(createGlobalId(item.id, type))
    }

    const { startDateTime } = item

    if (startDateTime && startDateTime !== '') {
      const mStartDateTime = momentTz(startDateTime).tz(ROCK.TIMEZONE)
      if (mStartDateTime.isValid() && mStartDateTime.isAfter(momentTz())) {
        console.log("SET A JOB")

        console.log(this)
      }
    }

    const indexableItem = await this.mapItemToAlgolia(item)

    // return this.addObjects([indexableItem])
  }

  resolveContentItem(item) {
    const { ContentItem } = this.context.dataSources;
    return ContentItem.resolveType(item);
  }

  async mapItemToAlgolia(item) {
    const type = await this.resolveContentItem(item);

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