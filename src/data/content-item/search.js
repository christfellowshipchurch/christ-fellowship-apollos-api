import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock';
import { createGlobalId } from '@apollosproject/server-core'
import ApollosConfig from '@apollosproject/config';

import Queue from 'bull';
import { graphql } from 'graphql';
import Redis from 'ioredis';
import keywordExtractor from 'keyword-extractor';
import { take, get, split } from 'lodash';
import momentTz from 'moment-timezone';
import sizeof from 'object-sizeof';
import sanitizeHtml from 'sanitize-html';

const MAX_SIZE = 10000; // bytes
const { REDIS_URL, CONTENT } = process.env;

const redis = new Redis(REDIS_URL);

// :: Utils
// ----------------------------------------------------------------------------

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
};

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

// :: Main Class
// ----------------------------------------------------------------------------

/**
 * Creates a new base class that adds Algolia search features.
 */
export default class SearchableContentItem extends coreContentItem.dataSource {
  getSearchIndex() {
    return this.context.dataSources.Search.index('ContentItems');
  }

  resolveType(props) {
    const { clientVersion } = this.context;
    const { attributeValues, contentChannelTypeId } = props;
    const versionParse = split(clientVersion, '.').join('');

    /**
     * Versions of the app that are a lower version than 5.2.1 have a bug
     * that will crash the app whenever a DevotionalContentItem is referenced.
     *
     * In order to counter-balance that, we just wanna make sure the request
     * is coming from something higher than version 5.2.0 before we start
     * dynamically returning DevotionalContentItem as a resolved type
     */
    if (parseInt(versionParse) > 520) {
      if (get(attributeValues, 'scriptures.value', '') !== '') {
        return 'DevotionalContentItem';
      }
    }

    /**
     * Versions of the app that are lower than 5.4.0 have a visual bug where they
     * don't ever show dates/times on EventContentItems.
     *
     * We have an error in logic where the `hideLabel` boolean flag is not respected,
     * so we need to just resolve all `EventContentItem` types to `InformationalContentItem`
     * to avoid the visual issue.
     */
    if (parseInt(versionParse) < 540) {
      if (
        get(
          ROCK_MAPPINGS,
          'CONTENT_ITEM.EventContentItem.ContentChannelTypeId',
          []
        ).includes(contentChannelTypeId)
      ) {
        return 'InformationalContentItem';
      }
    }

    return super.resolveType(props);
  }

  async indexAllGeneralContent() {
    const contentItems = await this
      .request()
      .filterOneOf([43, 45, 60, 63].map(n => `ContentChannelId eq ${n}`))
      .andFilter(this.byActive())
      .get();

    const indexableItems = await Promise.all(
      contentItems.map((item) => this.mapItemToAlgolia(item))
    );

    this.getSearchIndex().addObjects(indexableItems);
  }

  async mapItemToAlgolia(item) {
    const type = await this.resolveType(item);

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

  async updateContentItemIndex(id) {
    // const log = (msg) => console.log(`\n\x1b[35m${msg}\x1b[30m\n`);
    const log = (msg) => console.log(`\n*** Search Index Log ***\n${msg}\n\n`);
    log(`updateContentItemIndex(${id})`)

    /** Resolve the Content Item */
    const item = await this.getFromId(id);
    if (!item) {
      return null;
    }

    const hideFromSearch = get(item, "attributeValues.hideFromSearch.value", "false").toLowerCase();

    /** Delete the item if it should not be included in Search */
    if (hideFromSearch === "true") {
      const type = await this.resolveContentItem(item);
      return this.getSearchIndex().deleteObject(createGlobalId(item.id, type));
    }

    /** Resolve the item to an indexable item and get the Start Date */
    const indexableItem = await this.mapItemToAlgolia(item);
    const { startDateTime } = item;

    /** Set a key for the index that is unique to the item.
     *
     *  Since Rock is telling us that this Content Item needs
     *  to be update, we need to delete all currently existing
     *  jobs to make sure that we don't index more than needed
     */
    const indexKey = `algolia-index-${indexableItem.id}`;
    await deleteKeysByPattern(`bull:${indexKey}:*`);

    /** If a start date exists, and that date is in the future, we want to
     *  set a job that updates the item automatically on the day it should
     *  be active
     */
    if (startDateTime && startDateTime !== '') {
      const mStartDateTime = momentTz(startDateTime).tz(ApollosConfig.ROCK.TIMEZONE);

      log(`${momentTz().format()} : ${item.title} has a start date of ${mStartDateTime.format()}`);

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
        const itemQueue = new Queue(indexKey, REDIS_URL);
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
          const { data } = job;
          const { action, item } = data;

          if (action === "update") {
            log(`Running scheduled search index update for "${item.title}"`);
            return this.getSearchIndex().addObjects([item]);
          }
        });

        return null
      }
    }

    log(`Updating search index for "${item.title}"`)
    return this.getSearchIndex().addObjects([indexableItem])
  }

  async deltaIndex({ datetime }) {
    let itemsLeft = true;
    const args = { after: null, first: 100 };

    while (itemsLeft) {
      const { edges } = await this.paginate({
        cursor: await this.byDateAndActive({ datetime }),
        args,
      });

      const result = await edges;
      const items = result.map(({ node }) => node);
      itemsLeft = items.length === 100;

      if (itemsLeft) args.after = result[result.length - 1].cursor;
      const indexableItems = await Promise.all(
        items.map((item) => this.mapItemToAlgolia(item))
      );

      await this.addObjects(indexableItems);
    }
  }

  async indexAll() {
    await new Promise((resolve, reject) =>
      this.index.clearIndex((err, result) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      })
    );
    let itemsLeft = true;
    const args = { after: null, first: 100 };

    while (itemsLeft) {
      const { edges } = await this.paginate({
        cursor: this.byActive(),
        args,
      });

      const result = await edges;
      const items = result.map(({ node }) => node);
      itemsLeft = items.length === 100;

      if (itemsLeft) args.after = result[result.length - 1].cursor;

      const indexableItems = await Promise.all(
        items.map((item) => this.mapItemToAlgolia(item))
      );

      await this.addObjects(indexableItems);
    }
  }
}