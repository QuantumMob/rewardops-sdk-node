/**
 * Create an item order within a PII-enabled program.
 *
 * Requirements:
 *
 * - Set `supportedLocales` and `piiServerUrl` config properties.
 * - Set `createOrderPii` request payload information.
 */
const util = require('util');

const RO = require('../lib/rewardops');
const config = require('./config.example.json');
const payloads = require('./payloads.example.json');

// standard setup
RO.config.set('apiServerUrl', config.sdk.apiServerUrl);
RO.config.set('apiVersion', config.sdk.apiVersion);
RO.config.set('clientId', config.sdk.clientId);
RO.config.set('clientSecret', config.sdk.clientSecret);

// PII-specific setup
RO.config.set('supportedLocales', config.sdk.supportedLocales);
RO.config.set('piiServerUrl', config.sdk.piiServerUrl);

const program = RO.program(config.program.programId, config.program.programCode);

// create order
util
  .promisify(program.orders.create)(payloads.requests.createOrderPii)
  .then(response => {
    console.log('response :>> ', JSON.stringify(response, undefined, 2));
  })
  .catch(error => console.log(JSON.stringify(error, undefined, 2)));
