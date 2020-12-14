import { parseRockKeyValuePairs, getIdentifierType, isRequired } from '../utils';

describe('ParseRockKeyValuePairs', () => {
  /* Test different use cases for parsing Key Value pairs that get passed from Rock */
  it('parses a key value pair string with no overrides', () => {
    const str = 'firstKey^firstValue|secondKey^secondValue';

    expect(parseRockKeyValuePairs(str)).toMatchSnapshot();
  });

  it('parses a key value pair string with key and value labeling overrides', () => {
    const str = 'firstKey^firstValue|secondKey^secondValue';

    expect(parseRockKeyValuePairs(str, 'keyOverride', 'valueOverride')).toMatchSnapshot();
  });

  it('parses a key value pair string that contains an empty key value pairing', () => {
    const str = 'firstKey^firstValue|^';

    expect(parseRockKeyValuePairs(str, 'keyOverride', 'valueOverride')).toMatchSnapshot();
  });

  it('is passed an empty string for the keyValueStr attribute and returns an empty array', () => {
    expect(parseRockKeyValuePairs('')).toEqual([]);
  });

  it('is passed null for the keyValueStr attribute and returns an empty array', () => {
    expect(parseRockKeyValuePairs(null)).toEqual([]);
  });

  /* Test the different use cases for parsing an Identifier */
  it('identifies an integer identifier', () => {
    const identifierType = getIdentifierType('123');

    expect(identifierType.type).toEqual('int');
    expect(identifierType).toMatchSnapshot();
  });

  it('identifies a guid identifier', () => {
    const identifierType = getIdentifierType('967d2b2c-1d2a-474f-bc6e-9278443b3d6a');

    expect(identifierType.type).toEqual('guid');
    expect(identifierType).toMatchSnapshot();
  });

  it('identifies a custom identifier', () => {
    const identifierType = getIdentifierType('some-custom-id');

    expect(identifierType.type).toEqual('custom');
    expect(identifierType).toMatchSnapshot();
  });
});

describe('Is Required', () => {
  const testMethod = (param = isRequired()) => param;

  it('Throws an error when a parameter is not passed', () => {
    expect(testMethod).toThrow(Error);
  });

  it("Doesn't throw any error when a parameter is passed", () => {
    expect(testMethod('success')).toBe('success');
  });
});
