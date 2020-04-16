import {
  ContentItem as coreContentItem,
  Utils
} from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import Hypher from 'hypher';
import english from 'hyphenation.en-us';
import moment from 'moment'
import {
  get,
  has,
  split,
  orderBy,
} from 'lodash'

import sanitizeHtml from '../sanitize-html'

import * as EventContentItem from '../event-content-item'
import * as InformationalContentItem from '../informational-content-item'
import * as WebsiteContentItem from '../website-content-item'
import * as WebsiteHtmlContentItem from '../website-html-content-item'
import * as WebsiteFeature from '../website-feature'
import * as WebsiteGroupContentItem from '../website-group-content-item'
import * as WebsitePagesContentItem from '../website-pages-content-item'
import { parseRockKeyValuePairs } from '../utils'

const { createImageUrlFromGuid } = Utils
const hypher = new Hypher(english);

const titleResolver = {
  title: ({ title: originalTitle, attributeValues }, { hyphenated }) => {
    // Check for an attribute value called titleOverride
    const titleOverride = get(attributeValues, 'titleOverride.value', originalTitle)
    const title = titleOverride !== ''
      ? titleOverride
      : originalTitle


    if (!hyphenated) {
      return title
    }
    const words = title.split(' ')

    /* We only want to hyphenate the end of words because Hyper uses a language dictionary to add
     * "soft" hyphens at the appropriate places. By only adding "soft" hyphens to the end of we
     * guarantee that words that can fit will and that words that can't fit don't wrap prematurely.
     * Essentially, meaning words will always take up the maximum amount of space they can and only
     * very very long words will wrap after the 7th character.
     *
     * Example:
     * Devotional can be hyphenated as "de-vo-tion-al." However, we hyphenate this word as
     * "devotion-al." This means that the word can always fit but usually return to a new line as
     * "devotional" rather than wrapping mid-word as "devo-tional". There are situations your mind
     * can create where this might a wrap at `devotion-al` but this is a worst worst case scenario
     * and in our tests was exceedingly rare in the English language.
     *
     * Additionally, The magic number below (7) is used here because our current
     * `HorizontalHighlighCard`s have a fixed width of 240px and 7 is the maximum number of capital
     * "W" characters that will fit with a hyphen in our current typography. While this is an
     * unlikely occurrence it represents the worst case scenario for word length.
     *
     * TODO: Expose the hyphenation point to make this more flexible in the future.
     */
    const hyphenateEndOfWord = (word, segment) =>
      word.length > 7 ? word + '\u00AD' + segment : word + segment

    const hyphenateLongWords = (word, hyphenateFunction) =>
      word.length > 7 ? hyphenateFunction(word) : word

    return words
      .map((w) =>
        hyphenateLongWords(w, () =>
          hypher.hyphenate(w).reduce(hyphenateEndOfWord)
        )
      )
      .join(' ')
  },
  htmlContent: ({ content }) => sanitizeHtml(content),
}

const resolverExtensions = {
  ...titleResolver,
  sharing: (root, args, { dataSources: { ContentItem } }, { parentType }) => ({
    url: ContentItem.generateShareUrl(root, parentType),
    title: 'Share via ...',
    message: ContentItem.generateShareMessage(root),
  }),
  tags: ({ attributeValues }) =>
    split(get(attributeValues, 'tags.value', ''), ','),
  icon: ({ attributeValues }) => {
    const parsed = parseRockKeyValuePairs(get(attributeValues, 'icon.value', 'book-open'))
    return get(parsed, '[0].key', 'book-open')
  },
  estimatedTime: ({ attributeValues }) =>
    get(attributeValues, 'estimatedTime.value', null),
  publishDate: ({ startDateTime }) =>
    moment(startDateTime).toISOString(),
  author: async ({ attributeValues }, args, { dataSources }) => {
    if (get(attributeValues, 'author.value', null)) {
      const { id } = await dataSources.Person.getFromAliasId(attributeValues.author.value)

      const person = await dataSources.Person.getFromId(id)

      return {
        ...person,
        photo: {
          url: createImageUrlFromGuid(get(person, 'photo.guid', ''))
        }
      }
    }

    return null
  },
}

const resolver = {
  Query: {
    getContentItemByTitle: async (root, { title }, { dataSources }) =>
      dataSources.ContentItem.getContentByTitle(title),
    getCategoryByTitle: async (root, { title }, { dataSources }) =>
      dataSources.ContentItem.getCategoryByTitle(title),
    getEventContentByTitle: async (root, { title }, { dataSources }) =>
      dataSources.ContentItem.getEventByTitle(title),
    allEvents: async (root, args, { dataSources }) => {
      const events = await dataSources.ContentItem.getEvents()
      const sorted = orderBy(events,
        (n) => moment(n.startDateTime).format('YYYYMMDD'),
        ['asc']
      )

      return sorted
    },
    featuredEvents: (root, args, { dataSources }) =>
      dataSources.ContentItem.paginate({
        cursor: dataSources.ContentItem.getFeaturedEvents(),
        args,
      }),
    sermons: (root, args, { dataSources }) =>
      dataSources.ContentItem.paginate({
        cursor: dataSources.ContentItem.getSermonFeed(),
        args,
      }),
    getWebsitePageContentByTitle: async (root, { website, title }, context) =>
      await context.dataSources.WebsitePagesContentItem.getWebsitePageContentByTitle(website, title),
  },
  ContentItem: {
    ...titleResolver,
  },
  DevotionalContentItem: {
    ...resolverExtensions,
  },
  UniversalContentItem: {
    ...resolverExtensions,
  },
  ContentSeriesContentItem: {
    ...resolverExtensions
  },
  MediaContentItem: {
    ...resolverExtensions
  },
  WeekendContentItem: {
    ...resolverExtensions
  },
  ...EventContentItem.resolver,
  ...InformationalContentItem.resolver,
  ...WebsiteContentItem.resolver,
  ...WebsiteHtmlContentItem.resolver,
  ...WebsiteFeature.resolver,
  ...WebsiteGroupContentItem.resolver,
  ...WebsitePagesContentItem.resolver,
}

export default resolverMerge(resolver, coreContentItem)
