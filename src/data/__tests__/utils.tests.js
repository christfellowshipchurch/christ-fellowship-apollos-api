import { parseRockKeyValuePairs } from '../utils'

describe('ParseRockKeyValuePairs', () => {
    /* Test different use cases for parsing Key Value pairs that get passed from Rock */
    it('parses a key value pair string with no overrides', () => {
        const str = 'firstKey^firstValue|secondKey^secondValue'

        expect(parseRockKeyValuePairs(str)).toMatchSnapshot()
    })

    it('parses a key value pair string with key and value labeling overrides', () => {
        const str = 'firstKey^firstValue|secondKey^secondValue'

        expect(parseRockKeyValuePairs(str, 'keyOverride', 'valueOverride')).toMatchSnapshot()
    })

    it('parses a key value pair string that contains an empty key value pairing', () => {
        const str = 'firstKey^firstValue|^'

        expect(parseRockKeyValuePairs(str, 'keyOverride', 'valueOverride')).toMatchSnapshot()
    })
  
    it('is passed an empty string for the keyValueStr attribute and returns an empty array', () => {
        expect(parseRockKeyValuePairs('')).toEqual([])
    })

    it('is passed null for the keyValueStr attribute and returns an empty array', () => {
        expect(parseRockKeyValuePairs(null)).toEqual([])
    })
})