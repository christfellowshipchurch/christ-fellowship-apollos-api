import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import { get, find, kebabCase, toLower, upperCase, split, parseInt } from 'lodash';
import moment from 'moment-timezone';

import { createVideoUrlFromGuid } from '../utils';

const { ROCK_MAPPINGS, ROCK, FEATURE_FLAGS } = ApollosConfig;

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
    /**
     * Find the Association Order for the given content channel items
     */
    const { order: orderA } = associations.find(
      (item) => item.childContentChannelItemId === a.id
    );
    const { order: orderB } = associations.find(
      (item) => item.childContentChannelItemId === b.id
    );

    /**
     * Compare functions want either `0`, `< 0` or `> 0` as a return value, so we'll just subtract
     * orderA - orderB in order to mimic the `Order asc` request
     */
    return orderA - orderB;
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

  getFromId = async (id) => {
    const { Cache } = this.context.dataSources;

    const cachedKey = `${process.env.CONTENT}_contentItem_${id}`;
    const cachedValue = await Cache.get({
      key: cachedKey,
    });

    if (cachedValue) {
      return cachedValue;
    }

    const contentItem = await this.request().find(id).get();

    if (contentItem) {
      await Cache.set({
        key: cachedKey,
        data: contentItem,
        expiresIn: 60 * 15, // 15 minute cache
      });
    }

    return contentItem;
  };

  byAttributeValue = async (key, value) => {
    const requestBase = 'ContentChannelItems/GetByAttributeValue';
    return this.request(
      `${requestBase}?attributeKey=${key}&value=${value}&loadAttributes=expanded`
    ).filter(ContentItem.LIVE_CONTENT());
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
        embedHtml: get(attributeValues, 'videoEmbed.value', null), // TODO: this assumes that the key `VideoEmebed` is always used on Rock
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

    const { Cache } = this.context.dataSources;
    const cachedKey = `${process.env.CONTENT}_eventContentItems`;
    let eventItems = await Cache.get({
      key: cachedKey,
    });

    if (!eventItems) {
      eventItems = await this.request(`ContentChannelItems`)
        .filterOneOf(contentChannelTypes.map((n) => `ContentChannelTypeId eq ${n}`))
        .andFilter(this.LIVE_CONTENT())
        .orderBy('Order')
        .top(limit)
        .get();

      if (eventItems != null) {
        await Cache.set({
          key: cachedKey,
          data: eventItems,
          expiresIn: 60 * 5, // 5 minute cache
        });
      }
    }

    return eventItems
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
  getAssociationCursorByContentItemId = async (id) => {
    return (
      this.request('ContentChannelItemAssociations')
        // .expand('ChildContentChannel')
        .filter(`ContentChannelItemId eq ${id}`)
        .andFilter(this.CHILDREN_LIVE_CONTENT())
        .sort(this.CONTENT_ITEM_ASSOCIATION_SORT())
        .cache({ ttl: 60 })
    );
  };

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
}
