import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock';
import { get, find, kebabCase, take, toLower, upperCase, split, parseInt } from 'lodash';
import moment from 'moment-timezone';
import Queue from 'bull';
import { graphql } from 'graphql';
import Redis from 'ioredis';
import keywordExtractor from 'keyword-extractor';
import sizeof from 'object-sizeof';
import sanitizeHtml from 'sanitize-html';

import { createVideoUrlFromGuid, getIdentifierType } from '../utils';

const { ROCK_MAPPINGS, ROCK, FEATURE_FLAGS } = ApollosConfig;

// Search Config & Utils
// ----------------------------------------------------------------------------

const MAX_SIZE = 10000; // bytes
const { REDIS_URL, CONTENT } = process.env;

const redis = REDIS_URL ? new Redis(REDIS_URL) : null;

const cleanHtmlContentForIndex = (htmlContent) => {
  // Strip all html tags
  const cleanedHtml = sanitizeHtml(htmlContent, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return keywordExtractor.extract(cleanedHtml, {
    language: 'english',
    remove_digits: true,
    return_changed_case: true,
    remove_duplicates: true,
  });
};

const processObjectSize = (obj) => {
  const objSize = sizeof(obj);

  // If the object is smaller than the max size, return it
  if (objSize < MAX_SIZE) return obj;

  // Calculate the size of the htmlContent and the rest of the props
  const htmlContentSize = sizeof(obj.htmlContent);
  const objPropSize = objSize - htmlContentSize;

  if (objPropSize > MAX_SIZE) {
    // TODO : handle an object that exceeds the max size without any htmlContent
    return obj;
  }

  // Calculate the max size that the html content array can be.
  const maxContentSize = MAX_SIZE - objPropSize;
  // Calculate the new length of the array based on the % reduction
  // that needs to be had. It's not exact, but it should be decent
  // enough for right now.
  //
  // Ex: if we need a 50% reduction in the array size, cut the array's
  // length in half
  const percentReduction = maxContentSize / htmlContentSize;
  const newArrayLength =
    obj.htmlContent.length - obj.htmlContent.length * percentReduction;

  return {
    ...obj,
    htmlContent: take(obj.htmlContent, newArrayLength),
  };
};

const deleteKeysByPattern = (pattern) =>
  new Promise((resolve, reject) => {
    const stream = redis.scanStream({
      match: pattern,
    });
    stream.on('data', (keys) => {
      if (keys.length) {
        const pipeline = redis.pipeline();
        keys.forEach((key) => {
          pipeline.del(key);
        });
        pipeline.exec();
      }
    });
    stream.on('end', () => {
      resolve();
    });
    stream.on('error', (e) => {
      reject(e);
    });
  });

export default class ContentItem extends coreContentItem.dataSource {
  expanded = true;

  CORE_LIVE_CONTENT = this.LIVE_CONTENT;

  // MARK : - Utils
  /**
   * @param {Object[]} associations - Rock Content Channel Item Associations
   *
   * @return {function}
   */
  sortByAssociationOrder = (associations) => (a, b) => {
    // Check to make sure that associations is an array
    // Check to make sure that a.id and b.id are numbers
    if (Array.isArray(associations) && Number.isInteger(a.id) && Number.isInteger(b.id)) {
      const { id: aId } = a;
      const { id: bId } = b;

      // Find _either_ a child or parent association
      const associationA = associations.find(
        (association) =>
          association.childContentChannelItemId === aId ||
          association.contentChannelItemId === aId
      );
      const associationB = associations.find(
        (association) =>
          association.childContentChannelItemId === bId ||
          association.contentChannelItemId === bId
      );

      if (Number.isInteger(associationA.order) && Number.isInteger(associationB.order)) {
        return associationA.order - associationB.order;
      }
    }

    return 0;
  };

  CONTENT_ITEM_ASSOCIATION_SORT = () => [{ field: 'Order', direction: 'asc' }];

  LIVE_CONTENT = () => {
    // If we're in a staging environment, we want to
    //  return null so that no filter is applied over
    //  the content querying.
    // If we're not in a staging environment, we want
    //  to apply the standard LIVE_CONTENT filter based
    //  on the config.yml settings

    if (process.env.CONTENT === 'stage') {
      return null;
    }

    return this.CORE_LIVE_CONTENT();
  };

  CHILDREN_LIVE_CONTENT = () => {
    // If we're in a staging environment, we want to
    //  return null so that no filter is applied over
    //  the content querying.
    // If we're not in a staging environment, we want
    //  to apply the standard LIVE_CONTENT filter based
    //  on the config.yml settings

    if (process.env.CONTENT === 'stage') {
      return null;
    }

    // get a date in the local timezone of the rock instance.
    // will create a timezone formatted string and then strip off the offset
    // should output something like 2019-03-27T12:27:20 which means 12:27pm in New York
    const date = moment()
      .tz(ROCK.TIMEZONE)
      .format()
      .split(/[-+]\d+:\d+/)[0];
    const filter = `(((ChildContentChannelItem/StartDateTime lt datetime'${date}') or (ChildContentChannelItem/StartDateTime eq null)) and ((ChildContentChannelItem/ExpireDateTime gt datetime'${date}') or (ChildContentChannelItem/ExpireDateTime eq null))) and (((ChildContentChannelItem/Status eq 'Approved') or (ChildContentChannelItem/ContentChannel/RequiresApproval eq false)))`;
    return get(ROCK, 'SHOW_INACTIVE_CONTENT', false) ? null : filter;
  };

  getFromId = async (id) => {
    const { Cache } = this.context.dataSources;
    const { type } = getIdentifierType(id);
    let _id = id;

    if (type === 'guid') {
      _id = await this.getIdFromGuid(id);
    }

    if (_id) {
      return Cache.request(() => this.request().find(_id).get(), {
        key: Cache.KEY_TEMPLATES.contentItem`${_id}`,
        expiresIn: 60 * 60 * 12, // 12 hour cache
      });
    }

    return null;
  };

  getIdFromGuid = async (guid) => {
    const { Cache } = this.context.dataSources;
    const { query } = getIdentifierType(guid);

    return Cache.request(
      () =>
        this.request()
          .filter(query)
          .transform((results) => results[0]?.id)
          .get(),
      {
        key: Cache.KEY_TEMPLATES.contentItemGuidId`${guid}`,
        expiresIn: 60 * 60 * 24, // 24 hour cache
      }
    );
  };

  createSummary = (root) => get(root, 'attributeValues.summary.value', '');

  byAttributeValue = (key, value) => {
    const requestBase = 'ContentChannelItems/GetByAttributeValue';
    return this.request(
      `${requestBase}?attributeKey=${key}&value=${value}&loadAttributes=expanded`
    ).filter(this.LIVE_CONTENT());
  };

  attributeIsRedirect = ({ key, attributeValues, attributes }) =>
    key.toLowerCase().includes('redirect') &&
    typeof attributeValues[key].value === 'string' &&
    attributeValues[key].value.startsWith('http') && // looks like a url
    attributeValues[key].value !== ''; // is not empty

  hasRedirect = ({ attributeValues, attributes }) =>
    Object.keys(attributes).filter((key) =>
      this.attributeIsRedirect({
        key,
        attributeValues,
        attributes,
      })
    ).length;

  attributeIsCallToAction = ({ key, attributeValues, attributes }) =>
    key.toLowerCase().includes('call') &&
    key.toLowerCase().includes('action') &&
    typeof attributeValues[key].value === 'string' &&
    attributeValues[key].value !== ''; // is not empty

  hasCallToAction = ({ attributeValues, attributes }) =>
    Object.keys(attributes).filter((key) =>
      this.attributeIsRedirect({
        key,
        attributeValues,
        attributes,
      })
    ).length;

  formatTitleAsUrl = (title) => kebabCase(toLower(title));

  getVideos = ({ attributeValues, attributes }) => {
    const videoKeys = Object.keys(attributes).filter((key) =>
      this.attributeIsVideo({
        key,
        attributeValues,
        attributes,
      })
    );

    return videoKeys
      .map((key) => ({
        __typename: 'VideoMedia',
        key,
        name: attributes[key].name,
        embedHtml: get(attributeValues, 'videoEmbed.value', null), // TODO: this assumes that the key `VideoEmbed` is always used on Rock
        sources: attributeValues[key].value
          ? [{ uri: createVideoUrlFromGuid(attributeValues[key].value) }]
          : [],
      }))
      .filter(
        (video) =>
          video.sources.length > 0 && !video.sources.find((source) => source.uri === '')
      );
  };

  // title pattern should follow: the-article-title
  getByTitle = async (title, mapping) => {
    const contentChannels = get(ROCK_MAPPINGS, mapping, []);

    if (title === '' || contentChannels.length === 0) return null;

    const contentItems = await this.request(`ContentChannelItems`)
      .filterOneOf(contentChannels.map((n) => `ContentChannelId eq ${n}`))
      .andFilter(`toupper(Title) eq '${upperCase(title)}'`)
      .get();

    return find(
      contentItems,
      (n) => this.formatTitleAsUrl(get(n, 'title', '')) === this.formatTitleAsUrl(title)
    );
  };

  getContentByTitle = (title) => this.getByTitle(title, 'BROWSE_CONTENT_CHANNEL_IDS');

  getCategoryByTitle = (title) => this.getByTitle(title, 'CATEGORY_CONTENT_CHANNEL_IDS');

  getFromTypeIds = (ids) =>
    this.request()
      .filterOneOf(ids.map((n) => `ContentChannelTypeId eq ${n}`))
      .get();

  async getEventContentIds(limit) {
    const { Cache } = this.context.dataSources;
    const contentChannelTypes = get(
      ROCK_MAPPINGS,
      'CONTENT_ITEM.EventContentItem.ContentChannelTypeId',
      []
    );

    if (contentChannelTypes.length === 0) {
      console.warn('No Content Channel Types were found for events');
      return [];
    }

    return Cache.request(
      () =>
        this.request(`ContentChannelItems`)
          .filterOneOf(contentChannelTypes.map((n) => `ContentChannelTypeId eq ${n}`))
          .andFilter(this.LIVE_CONTENT())
          .select('Id')
          .orderBy('Order')
          .top(limit)
          .transform((results) => results.filter((item) => !!item.id).map(({ id }) => id))
          .get(),
      {
        key: Cache.KEY_TEMPLATES.eventContentItems,
        expiresIn: 60 * 60, // 1 hour cache
      }
    );
  }

  getEvents = async (limit) => {
    const { Person } = this.context.dataSources;
    const contentChannelTypes = get(
      ROCK_MAPPINGS,
      'CONTENT_ITEM.EventContentItem.ContentChannelTypeId',
      []
    );

    if (contentChannelTypes.length === 0) {
      console.warn('No Content Channel Types were found for events');
      return null;
    }

    const usePersonas = FEATURE_FLAGS.ROCK_DYNAMIC_FEED_WITH_PERSONAS.status === 'LIVE';
    let personas = [];
    if (usePersonas) {
      try {
        personas = await Person.getPersonas({
          categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId,
        });
      } catch (e) {
        console.log('Events: Unable to retrieve personas for user.');
        console.log(e);
      }
    }

    const eventIds = await this.getEventContentIds(limit);
    const contentItems = await Promise.all(eventIds.map((id) => this.getFromId(id)));

    return contentItems
      .map((event) => {
        const securityDataViews = split(
          get(event, 'attributeValues.securityDataViews.value', ''),
          ','
        ).filter((dv) => !!dv);

        if (securityDataViews.length > 0) {
          const userInSecurityDataViews = personas.filter(({ guid }) =>
            securityDataViews.includes(guid)
          );
          if (userInSecurityDataViews.length === 0) {
            console.log('User does not have access to this item');
            return null;
          }
        }

        return event;
      })
      .filter((event) => !!event);
  };

  getFeaturedEvents = () => {
    const contentChannelTypes = get(
      ROCK_MAPPINGS,
      'CONTENT_ITEM.EventContentItem.ContentChannelTypeId',
      []
    );

    return this.request()
      .filterOneOf(contentChannelTypes.map((n) => `ContentChannelTypeId eq ${n}`))
      .andFilter(this.LIVE_CONTENT())
      .andFilter('Priority gt 0') // featured events have a priority in Rock >0
      .orderBy('Priority', 'desc');
  };

  getEventByTitle = async (title) => {
    if (title === '') return null;

    const contentItems = await this.getEvents();

    return find(
      contentItems,
      (n) => this.formatTitleAsUrl(get(n, 'title', '')) === this.formatTitleAsUrl(title)
    );
  };

  byContentChannelId = (id) =>
    this.request()
      .filter(`ContentChannelId eq ${id}`)
      .andFilter(this.LIVE_CONTENT())
      .cache({ ttl: 60 })
      .orderBy('Order');

  generateShareUrl = ({ id: rockId, title }, parentType) => {
    const resolvedId = createGlobalId(rockId, parentType).split(':');
    const typename = resolvedId[0];
    const id = resolvedId[1];

    switch (typename) {
      case 'EventContentItem':
        return `${ROCK.SHARE_URL}/events/${this.formatTitleAsUrl(title)}`;
      case 'InformationalContentItem':
        return `${ROCK.SHARE_URL}/items/${id}`;
      default:
        return `${ROCK.SHARE_URL}/content/${id}`;
    }
  };

  generateShareMessage = (root) => {
    const { title } = root;
    const customMessage = get(root, 'attributeValues.shareMessage.value', '');

    if (customMessage && customMessage !== '') return customMessage;

    return `${title} - ${this.createSummary(root)}`;
  };

  // MARK : - Core DataSource overrides
  /**
   * Gets all Content Channel Item Associations for a given Content Channel Item
   * @param {number} id - Rock Id of the Content Channel Item for the Association
   */
  getAssociationCursorByContentItemId = async (id) =>
    this.request('ContentChannelItemAssociations')
      // .expand('ChildContentChannel')
      .filter(`ContentChannelItemId eq ${id}`)
      .andFilter(this.CHILDREN_LIVE_CONTENT())
      .sort(this.CONTENT_ITEM_ASSOCIATION_SORT())
      .cache({ ttl: 60 });

  /**
   * Gets all Child Content Channel Items for a given Parent Content Channel Item
   * @param {number} id - Rock Id of the Parent Content Channel Item
   */
  getCursorByParentContentItemId = async (id) => {
    const associations = await this.request('ContentChannelItemAssociations')
      .filter(`ContentChannelItemId eq ${id}`)
      .sort(this.CONTENT_ITEM_ASSOCIATION_SORT())
      .cache({ ttl: 60 })
      .get();

    if (!associations || !associations.length) return this.request().empty();

    return this.getFromIds(
      associations.map(({ childContentChannelItemId }) => childContentChannelItemId)
    ).transform((results) => results.sort(this.sortByAssociationOrder(associations)));
  };

  /**
   * Gets all Parent Content Channel Items for a given Child Content Channel Item
   * @param {number} id - Rock Id of the Child Content Channel Item
   */
  getCursorByChildContentItemId = async (id) => {
    const associations = await this.request('ContentChannelItemAssociations')
      .filter(`ChildContentChannelItemId eq ${id}`)
      .sort(this.CONTENT_ITEM_ASSOCIATION_SORT())
      .cache({ ttl: 60 })
      .get();

    if (!associations || !associations.length) return this.request().empty();

    return this.getFromIds(
      associations.map(({ contentChannelItemId }) => contentChannelItemId)
    ).transform((results) => results.sort(this.sortByAssociationOrder(associations)));
  };

  /**
   * Gets the Ids of all Child Content Items for a given Content Channel Item Id
   * @param {number} id - Rock Id of the Parent Content Channel Item
   * @return {array}
   */
  getChildrenIds = async (id) => {
    const { Cache } = this.context.dataSources;
    const request = async () => {
      const cursor = (await this.getCursorByParentContentItemId(id))
        .expand('ContentChannel')
        .transform((results) => results.filter((item) => !!item.id).map(({ id }) => id));

      return cursor.get();
    };

    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.contentItemChildren`${id}`,
      expiresIn: 60 * 60 * 12, // 12 hour cache,
    });
  };

  // Search
  // --------------------------------------------------------------------------

  getSearchIndex() {
    return this.context.dataSources.Search.index('CONTENT_ITEMS');
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

  resolveContentItem(item) {
    const { ContentItem } = this.context.dataSources;
    return ContentItem.resolveType(item);
  }

  async indexAllGeneralContent() {
    const contentItems = await this.request()
      .filterOneOf([43, 45, 60, 63].map((n) => `ContentChannelId eq ${n}`))
      .andFilter(this.byActive())
      .get();

    const indexableItems = await Promise.all(
      contentItems.map((item) => this.mapItemToAlgolia(item))
    );

    this.getSearchIndex().addObjects(indexableItems);
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
      htmlContent: cleanHtmlContentForIndex(data.node.htmlContent),
    });
  }

  async updateContentItemIndex(id) {
    // const log = (msg) => console.log(`\n\x1b[35m${msg}\x1b[30m\n`);
    const log = (msg) => console.log(`\n*** Search Index Log ***\n${msg}\n\n`);
    log(`updateContentItemIndex(${id})`);

    /** Resolve the Content Item */
    const item = await this.getFromId(id);
    if (!item) {
      return null;
    }

    const hideFromSearch = get(
      item,
      'attributeValues.hideFromSearch.value',
      'false'
    ).toLowerCase();

    /** Delete the item if it should not be included in Search */
    if (hideFromSearch === 'true') {
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
      const mStartDateTime = moment(startDateTime).tz(ApollosConfig.ROCK.TIMEZONE);

      log(
        `${moment().format()} : ${
          item.title
        } has a start date of ${mStartDateTime.format()}`
      );

      if (mStartDateTime.isValid() && mStartDateTime.isAfter(moment())) {
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
          timestamp: moment().format('hh:mm:ss'),
        };
        const options = {
          delay: mStartDateTime.diff(moment()),
          attempts: 2,
          prefix: `bull-${CONTENT}`,
        };

        log(`Scheduling search index update for "${item.title}"`);
        itemQueue.add(data, options);
        itemQueue.process((job) => {
          /** Get the item from our job data so that we can go ahead
           *  and execute our search
           *
           *  TODO : end date auto-remove
           */
          const { data } = job;
          const { action, item } = data;

          if (action === 'update') {
            log(`Running scheduled search index update for "${item.title}"`);
            return this.getSearchIndex().addObjects([item]);
          }
        });

        return null;
      }
    }

    log(`Updating search index for "${item.title}"`);
    return this.getSearchIndex().addObjects([indexableItem]);
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

  async getFeatures(props) {
    let id = props;

    if (!Number.isInteger(props) && props.id) {
      id = props.id;
    }

    // note : get the children of Content Item
    const { Feature } = this.context.dataSources;
    const childrenIds = await this.getChildrenIds(id);
    const children = await Promise.all(childrenIds.map((id) => this.getFromId(id)));

    const features = await Promise.all(
      children.map((child) => {
        const { id, contentChannelId, contentChannelTypeId, title } = child;
        let typename = 'ContentBlock';

        // TESTING SOMETHING
        if (contentChannelId === 87) {
          return Feature.createVerticalCardListFeature({
            algorithms: [
              {
                type: 'CONTENT_CHILDREN',
                arguments: {
                  contentChannelItemId: id,
                  limit: 0,
                },
              },
            ],
            title,
            subtitle: this.createSummary(child),
          });
        }

        // if we have defined an ContentChannelTypeId based maping in the YML file, use it!
        if (
          Object.values(ROCK_MAPPINGS.FEATURE_MAPPINGS).some(
            ({ ContentChannelTypeId }) =>
              ContentChannelTypeId && ContentChannelTypeId.includes(contentChannelTypeId)
          )
        ) {
          typename = Object.keys(ROCK_MAPPINGS.FEATURE_MAPPINGS).find((key) => {
            const value = ROCK_MAPPINGS.FEATURE_MAPPINGS[key];
            return (
              value.ContentChannelTypeId &&
              value.ContentChannelTypeId.includes(contentChannelTypeId)
            );
          });
        }
        // if we have defined a ContentChannelId based maping in the YML file, use it!
        if (
          Object.values(ROCK_MAPPINGS.FEATURE_MAPPINGS).some(
            ({ ContentChannelId }) =>
              ContentChannelId && ContentChannelId.includes(contentChannelId)
          )
        ) {
          typename = Object.keys(ROCK_MAPPINGS.FEATURE_MAPPINGS).find((key) => {
            const value = ROCK_MAPPINGS.FEATURE_MAPPINGS[key];
            return (
              value.ContentChannelId && value.ContentChannelId.includes(contentChannelId)
            );
          });
        }

        if (!typename) return null;

        switch (typename) {
          case 'ContentBlock':
            return Feature.createContentBlockFeature({
              contentChannelItemId: id,
            });
          case 'HtmlBlock':
            return Feature.createHtmlBlockFeature({ contentChannelItemId: id });
          case 'HeroList':
            // todo :
            return null;
          case 'HorizontalCardList':
            return Feature.createHorizontalCardListFeature({
              algorithms: [
                {
                  type: 'CONTENT_CHILDREN',
                  arguments: {
                    contentChannelItemId: id,
                    limit: 0,
                  },
                },
              ],
              title,
              subtitle: this.createSummary(child),
              cardType: 'HIGHLIGHT',
              primaryAction: {
                title: 'See More',
                action: 'OPEN_URL',
                relatedNode: {
                  __typename: 'Url',
                  url: 'https://christfellowship.church',
                },
              },
            });
          case 'VerticalCardList':
            // todo :
            return null;
          default:
            return null;
        }
      })
    );

    return features.filter((feature) => !!feature);
  }
}
