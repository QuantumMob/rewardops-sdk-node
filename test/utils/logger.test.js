const mockDate = require('mockdate');
const faker = require('faker');
const _ = require('lodash');

const config = require('../../lib/config');
const { LOG_PREFIX } = require('../../lib/constants');
const { mockConfig } = require('../test-helpers/mock-config');

const {
  formatMessage,
  getLogLevel,
  log,
  logFormat,
  prettyPrint,
  redactSecrets,
  REDACTED_MESSAGE,
  filterLogData,
  processLogData,
} = jest.requireActual('../../lib/utils/logger');

// test setup
const timestamp = Date.now();

const originalConsole = console;
const mockConsole = { log: jest.fn(), warn: jest.fn() };
// freeze time
mockDate.set(timestamp);

// fixtures
const id = faker.datatype.uuid();

const PIIData = {
  id,
  full_name: faker.name.findName(),
  email: faker.internet.email(),
  phone: faker.phone.phoneNumber(),
  accept_language: 'en-CA',
  address: {
    address: faker.address.streetAddress(),
    address_2: faker.address.streetAddress(),
    city: faker.address.city(),
    country_code: 'CA',
    country_subregion_code: 'AB',
    postal_code: 'S0S 6V0',
  },
  gift: false,
  ip_address: '::ffff:127.0.0.1',
};

const filteredPIIData = {
  id,
  full_name: '[REDACTED]',
  email: '[REDACTED]',
  phone: '[REDACTED]',
  accept_language: 'en-CA',
  address: '[REDACTED]',
  gift: false,
  ip_address: '[REDACTED]',
};

const secrets = { username: 'Nick', password: 'Jonas' };
const redactedSecrets = { username: 'Nick', password: REDACTED_MESSAGE };

describe('#prettyPrint', () => {
  it('should stringify an object', () => {
    const result = prettyPrint({
      name: 'AuthenticationError',
      message: 'Client authentication failed due to unknown client',
    });
    const expectedResult = `{
  "name": "AuthenticationError",
  "message": "Client authentication failed due to unknown client"
}`;

    expect(result).toEqual(expectedResult);
  });

  it('should stringify an array', () => {
    const result = prettyPrint(['Error 1', 'Error 2']);
    const expectedResult = `[
  "Error 1",
  "Error 2"
]`;

    expect(result).toEqual(expectedResult);
  });

  it('should handle an array of objects', () => {
    const result = prettyPrint([{ error: 'Something' }, { error: 'Went Wrong' }]);
    const expectedResult = `[
  {
    "error": "Something"
  },
  {
    "error": "Went Wrong"
  }
]`;

    expect(result).toEqual(expectedResult);
  });

  it.each`
    input        | expected
    ${100}       | ${'100'}
    ${'foobar'}  | ${'"foobar"'}
    ${null}      | ${'null'}
    ${NaN}       | ${'null'}
    ${Infinity}  | ${'null'}
    ${undefined} | ${undefined}
  `('should handle primitives ($input -> $expected)', ({ input, expected }) => {
    expect(prettyPrint(input)).toEqual(expected);
  });
});

describe('#redactSecrets', () => {
  it.each`
    input                                          | secretPropPath
    ${{ secret: 'sauce' }}                         | ${['secret']}
    ${{ clientSecret: faker.datatype.uuid() }}     | ${['clientSecret']}
    ${{ creditCard: '1234 1234 1234 1234' }}       | ${['creditCard']}
    ${[{ password: faker.random.words() }]}        | ${[0, 'password']}
    ${[{ api: { token: faker.datatype.uuid() } }]} | ${[0, 'api', 'token']}
  `('should redact secrets from JSON-stringifiable objects', ({ input, secretPropPath }) => {
    expect(_.get(redactSecrets(input), secretPropPath)).toEqual(REDACTED_MESSAGE);
  });
});

describe('#formatMessage', () => {
  it.each`
    input                         | expectedSubstring
    ${{}}                         | ${'{}'}
    ${[]}                         | ${'[]'}
    ${[{ bar: [{ baz: 'yo' }] }]} | ${'"baz": "yo"'}
    ${{ secret: 'message' }}      | ${`"secret": "${REDACTED_MESSAGE}"`}
  `('should pretty-print and redact secrets from JSON-stringifiable objects', ({ input, expectedSubstring }) => {
    const formattedMessage = formatMessage(input);

    expect(typeof formattedMessage).toEqual('string');
    expect(formattedMessage).toEqual(expect.stringContaining(expectedSubstring));
  });

  it.each([100, 'foobar', null, NaN, Infinity, undefined])('should passthrough primitives (%p)', input => {
    expect(formatMessage(input)).toBe(input);
  });
});

describe('#getLogLevel', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('config settings', () => {
    test.each`
      verbose  | quiet    | expected
      ${false} | ${false} | ${'info'}
      ${true}  | ${false} | ${'verbose'}
      ${false} | ${true}  | ${'warn'}
      ${true}  | ${true}  | ${'verbose'}
    `(`returns '$expected' when 'verbose' is $verbose and 'quiet' is $quiet`, ({ verbose, quiet, expected }) => {
      config.set('verbose', verbose);
      config.set('quiet', quiet);

      expect(getLogLevel()).toEqual(expected);
    });
  });
});

describe('#filterLogData', () => {
  it.each([[], null, undefined, 1, 'foo'])('returns %p since it is not an object', input => {
    expect(filterLogData(input)).toBe(input);
  });

  it('should convert an Error object to a plain object', () => {
    const error = new Error('test error');

    const output = filterLogData(error);

    expect(output instanceof Error).toBe(false);
    expect(output).toEqual({ message: 'test error', name: 'Error', stack: expect.any(String) });
  });

  it('should filter out PII data from an Error object', () => {
    const error = new Error();
    error.metaData = PIIData;

    const output = filterLogData(error);

    expect(output.metaData).toEqual(filteredPIIData);
  });

  it('should redact secrets from an Error object', () => {
    const error = new Error();
    error.metaData = secrets;

    const output = filterLogData(error);

    expect(output.metaData).toEqual(redactedSecrets);
  });

  it('should filter out nested data', () => {
    const input = {
      endpoint: 'https://authEndpoint/token',
      queryParams: 'grant_type=refresh_token&refresh_token=refreshToken',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // this is the target to filter
        Authorization: `Basic ${faker.random.alphaNumeric()}`,
      },
    };

    const output = filterLogData(input);

    expect(output.headers).toEqual(expect.objectContaining({ Authorization: REDACTED_MESSAGE }));
  });

  it('should filter out PII', () => {
    const output = filterLogData(PIIData);

    expect(output).toEqual(filteredPIIData);
  });
});

describe('#processLogData', () => {
  it('should filter then pretty print the log data', () => {
    const output = processLogData(PIIData);

    expect(output).toEqual(prettyPrint(filteredPIIData));
  });
});

describe('#logFormat', () => {
  const mockTimestamp = new Date().toISOString();
  const mockLogLevel = faker.random.arrayElement(['error', 'warn', 'info', 'debug', 'verbose']);
  const mockMessage = faker.lorem.sentence();

  it('logs SDK prefix, timestamp, and log level', () => {
    expect.assertions(4);

    const formattedLog = logFormat({ level: mockLogLevel, message: mockMessage, timestamp: mockTimestamp });

    const EXPECTED_SUBSTRINGS = [LOG_PREFIX, mockTimestamp, mockLogLevel.toUpperCase(), mockMessage];
    EXPECTED_SUBSTRINGS.forEach(substring => {
      expect(formattedLog).toEqual(expect.stringContaining(substring));
    });
  });

  it('logs pretty-printed message, without unprovided metadata', () => {
    const formattedLog = logFormat({ level: mockLogLevel, message: { foo: 'bar' }, timestamp: mockTimestamp });

    expect(formattedLog).toEqual(
      expect.stringContaining(`{
  "foo": "bar"
}`)
    );
    expect(formattedLog).not.toEqual(expect.stringContaining('Metadata'));
  });

  it('logs pretty-printed metadata, if provided', () => {
    const formattedLog = logFormat({
      level: mockLogLevel,
      message: 'foobar',
      timestamp: mockTimestamp,
      meta: { baz: 'yo' },
    });

    expect(formattedLog).toEqual(
      expect.stringContaining(`\nMetadata:\t{
  "baz": "yo"
}`)
    );
  });

  it('filters PII from log messages', () => {
    expect.assertions(5);

    const mockClientId = faker.datatype.uuid();
    const messageWithPii = {
      clientId: mockClientId,
      clientSecret: faker.datatype.uuid(),
      foo: 'bar',
      apiToken: faker.datatype.uuid(),
      access_token: faker.datatype.uuid(),
    };
    const formattedLog = logFormat({ level: mockLogLevel, message: messageWithPii, timestamp: mockTimestamp });

    const EXPECTED_SUBSTRINGS = [
      `"clientId": "${mockClientId}"`,
      `"clientSecret": "${REDACTED_MESSAGE}"`,
      `"foo": "bar"`,
      `"apiToken": "${REDACTED_MESSAGE}"`,
      `"access_token": "${REDACTED_MESSAGE}"`,
    ];
    EXPECTED_SUBSTRINGS.forEach(substring => {
      expect(formattedLog).toEqual(expect.stringContaining(substring));
    });
  });

  it('logs inputs with correct format', () => {
    const formattedLog = logFormat({ level: mockLogLevel, message: mockMessage, timestamp: mockTimestamp });

    const expectedLog = `[${mockTimestamp}] [${LOG_PREFIX} ${mockLogLevel.toUpperCase()}] [${mockMessage}]`;

    expect(formattedLog).toEqual(expectedLog);
  });
});

describe('#log', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-global-assign
    console = mockConsole;
  });
  afterAll(() => {
    // eslint-disable-next-line no-global-assign
    console = originalConsole;
    mockDate.reset();
  });

  test('logs replace placeholders with the passed in data', () => {
    log('here is my {message}', { data: { message: 'foobar' } });

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('foobar'));
  });

  test('logs replace multiple placeholders with the passed in data', () => {
    const shoes = { brand: 'Nike', size: 12 };

    log('here is my {firstMessage}, and {shoes}', {
      data: { firstMessage: 'foobar', shoes },
    });

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('foobar'));
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(prettyPrint(shoes)));
  });

  test('logs filter PII and secrets when passed as data', () => {
    log('here are my {secrets}, and {PIIData}', {
      data: { secrets, PIIData },
    });

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(prettyPrint(filteredPIIData)));
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(prettyPrint(redactedSecrets)));
  });

  const expectedDate = new Date(timestamp);

  test('logs are printed in the correct format', () => {
    log('testLog');

    const EXPECTED_SUBSTRINGS = [LOG_PREFIX, 'INFO', `[${expectedDate.toISOString()}]`, 'testLog'];
    EXPECTED_SUBSTRINGS.forEach(substring => {
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(substring));
    });
  });

  test('options.level is present in the log', () => {
    log('errorLog', { level: 'error' });

    const EXPECTED_SUBSTRINGS = [LOG_PREFIX, 'ERROR', `[${expectedDate.toISOString()}]`, 'errorLog'];
    EXPECTED_SUBSTRINGS.forEach(substring => {
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(substring));
    });
  });

  test('instances of Error are parsed into the log', () => {
    expect.assertions(4);

    const error = new Error();
    error.message = 'errorMessage';
    error.stack = 'errorStack';

    log(error);

    const EXPECTED_SUBSTRINGS = [
      LOG_PREFIX,
      'ERROR',
      `[${expectedDate.toISOString()}]`,
      `${error.message}\n${error.stack}`,
    ];
    EXPECTED_SUBSTRINGS.forEach(substring => {
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(substring));
    });
  });

  describe('config settings', () => {
    test('options.meta is present in the log when `verbose` is true', () => {
      config.reset();
      config.init(mockConfig({ verbose: true }));

      log('testLog', { meta: { foo: 'bar' } });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('"foo": "bar"'));
    });

    test('options.meta is not present in the log when `verbose` is `false`', () => {
      config.reset();
      config.init(mockConfig({ verbose: false }));

      log('testLog', { meta: { foo: 'bar' } });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.not.stringContaining('"foo": "bar"'));
    });

    test('message is logged when `quiet` is true', () => {
      config.reset();
      config.init(mockConfig({ quiet: true }));

      log('testLog');

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('testLog'));
    });
  });
});
