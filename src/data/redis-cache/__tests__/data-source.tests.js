import CacheDS from '../data-source';

describe('the matrix item data source', () => {
  let Cache;
  let requestArgs;
  let requestNumber = 0;

  beforeEach(() => {
    Cache = new CacheDS();

    /**
     * Request number is set to increment by 1 after a request
     * is made for the first time.
     *
     * This means that when the first request is made, requestNumber
     * should always be `0`.
     * When the request is made, this value will be flipped to be 1
     * so that we know that the `set` method is happening.
     */
    requestNumber = 0;
    Cache.get = () => {
      if (requestNumber === 0) {
        return null;
      } else {
        return 'success';
      }
    };
    Cache.set = () => {
      requestNumber = 1;
    };

    requestArgs = { key: 'string-key', expiresIn: 60 };
  });

  // MARK : - Error Handling
  it('throws a TypeError when an incorrect `requestMethod` is passed', async () => {
    const request = async () => await Cache.request('some random string', requestArgs);

    try {
      await request();
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
    }
  });

  it('throws a TypeError when an incorrect `key` is passed', async () => {
    const request = async () => await Cache.request(() => null, { key: 100 });

    try {
      await request();
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
    }
  });

  it('successfully returns a value', async () => {
    const request = async () => await Cache.request(() => 'success', { key: 'test_key' });

    expect(await request()).toBe('success');
  });

  it('caches a value after an initial request', async () => {
    const request = async () => await Cache.request(() => 'success', { key: 'test_key' });

    expect(requestNumber).toBe(0);

    // First request
    await request();

    expect(requestNumber).toBe(1);
  });
});
