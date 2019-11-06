import { ContentItem as coreContentItem } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import { get } from 'lodash'

const resolver = {
  Query: {
    contentDecorations: (root, { id }, { dataSources }) =>
      dataSources.ContentItem.getDecorations({ id })
  },
  ContentItem: {
    title: ({ title: originalTitle, attributeValues }, { hyphenated }) => {
      // Check for an attribute value called titleOverride
      const title = get(attributeValues, 'titleOverride.value', originalTitle)

      if (!hyphenated) {
        return title;
      }
      const words = title.split(' ');

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
        word.length > 7 ? word + '\u00AD' + segment : word + segment;

      const hyphenateLongWords = (word, hyphenateFunction) =>
        word.length > 7 ? hyphenateFunction(word) : word;

      return words
        .map((w) =>
          hyphenateLongWords(w, () =>
            hypher.hyphenate(w).reduce(hyphenateEndOfWord)
          )
        )
        .join(' ');
    },
    // tags: () => []
  },
  ContentDecorations: {
    tags: ({ tags }) => tags,
    icon: ({ icon }) => icon
  }
}

export default resolverMerge(resolver, coreContentItem)
