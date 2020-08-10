import { dataSource as CoreDataSource } from '@apollosproject/data-connector-algolia-search';
import { createGlobalId } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config'
import Queue from 'bull'
import Redis from 'ioredis';
import { graphql } from 'graphql';
import { take, get } from 'lodash';
import sanitizeHtml from 'sanitize-html';
import keywordExtractor from 'keyword-extractor';
import sizeof from 'object-sizeof';
import momentTz from 'moment-timezone'

const { ROCK } = ApollosConfig

const MAX_SIZE = 10000 // bytes
const { REDIS_URL, CONTENT } = process.env;

const redis = new Redis(REDIS_URL);
let client;
let subscriber;
let queueOpts;

if (REDIS_URL) {
  client = new Redis(REDIS_URL);
  subscriber = new Redis(REDIS_URL);

  // Used to ensure that N+3 redis connections are not created per queue.
  // https://github.com/OptimalBits/bull/blob/develop/PATTERNS.md#reusing-redis-connections
  queueOpts = {
    createClient(type) {
      switch (type) {
        case 'client':
          return client;
        case 'subscriber':
          return subscriber;
        default:
          return new Redis(REDIS_URL);
      }
    },
  };
}

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

const deleteKeysByPattern = (pattern) => {
  return new Promise((resolve, reject) => {
    const stream = redis.scanStream({
      match: pattern
    });
    stream.on("data", (keys) => {
      if (keys.length) {
        const pipeline = redis.pipeline();
        keys.forEach((key) => {
          pipeline.del(key);
        });
        pipeline.exec();
      }
    });
    stream.on("end", () => {
      resolve();
    });
    stream.on("error", (e) => {
      reject(e);
    });
  });
};

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
    const log = (msg) => console.log(`\n\x1b[35m${msg}\x1b[30m\n`)
    /** Resolve the Content Item */
    const { ContentItem } = this.context.dataSources
    const item = await ContentItem.getFromId(id)
    if (!item) return null

    const hideFromSearch = get(item, "attributeValues.hideFromSearch.value", "false").toLowerCase()

    /** Delete the item if it should not be included in Search */
    if (hideFromSearch === "true") {
      const type = await this.resolveContentItem(item);
      return
      return this.index.deleteObject(createGlobalId(item.id, type))
    }

    /** Resolve the item to an indexable item and get the Start Date */
    const indexableItem = await this.mapItemToAlgolia(item)
    const { startDateTime } = item

    /** Set a key for the index that is unique to the item.
     *  
     *  Since Rock is telling us that this Content Item needs
     *  to be update, we need to delete all currently existing
     *  jobs to make sure that we don't index more than needed
     */
    const indexKey = `algolia-index-${indexableItem.id}`
    await deleteKeysByPattern(`bull:${indexKey}:*`)

    /** If a start date exists, and that date is in the future, we want to
     *  set a job that updates the item automatically on the day it should
     *  be active
     */
    if (startDateTime && startDateTime !== '') {
      const mStartDateTime = momentTz(startDateTime).tz(ROCK.TIMEZONE)
      if (mStartDateTime.isValid() && mStartDateTime.isAfter(momentTz())) {
        /** Set up the options for the bull job.
         * 
         *  We need to get the difference between now and the Start Time
         *  in milliseconds to set the delay. We can keep the attempts at
         *  2 just to be safe, but we shouldn't see any issues.
         * 
         *  Our Prefix gets set to include our content type just so that
         *  Redis doesn't get confused between our state and production
         *  content types.
         * 
         *  Since we're already in communication with Rock, let's just
         *  resolve the item to the indexable item and save that as a
         *  part of our data
         */
        const itemQueue = new Queue(indexKey, REDIS_URL)
        const data = {
          action: 'update',
          item: indexableItem,
          timestamp: momentTz().format('hh:mm:ss')
        };
        const options = {
          delay: mStartDateTime.diff(momentTz()),
          attempts: 2,
          prefix: `bull-${CONTENT}`,
        };

        log(`Scheduling search index update for "${item.title}"`)
        itemQueue.add(data, options);
        itemQueue.process(job => {
          /** Get the item from our job data so that we can go ahead
           *  and execute our search
           * 
           *  TODO : end date auto-remove
           */
          const { data } = job
          const { action, item } = data

          if (action === "update") {
            log(`Running scheduled search index update for "${item.title}"`)
            return this.addObjects([item])
          }
        });

        return null
      }
    }

    log(`Updating search index for "${item.title}"`)
    return this.addObjects([indexableItem])
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