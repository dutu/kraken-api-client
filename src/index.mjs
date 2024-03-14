import { RestWrapper } from './rest/restWrapper.mjs'
import { createWebSocketClient } from './webSocket/webSocketClient.mjs'
import { createOrderbookSubscriptionManager } from './orderbook/subscriptionManager.mjs'
import { noop } from './utils/noop.mjs'

/**
 * Kraken API client, providing access to various trading operations.
 */

/**
 * @typedef {Object} Authentication
 * @property {string} [apiKey] - The API key.
 * @property {string} [apiSecret] - The API secret.
 * @property {function} [nonce] - Function for generating a valid nonce.
 * @property {function} [otp] - Function for generating  one time password.
 */

/**
 * @typedef {Object} Logger
 * @property {Function} [emerg] - Emergency: system is unusable.
 * @property {Function} [alert] - Alert: action must be taken immediately.
 * @property {Function} [crit] - Critical: critical conditions.
 * @property {Function} [error] - Error: error conditions.
 * @property {Function} [warning] - Warning: warning conditions.
 * @property {Function} [notice] - Notice: normal but significant condition.
 * @property {Function} [info] - Informational: informational messages.
 * @property {Function} [debug] - Debug: debug-level messages.
 */

export class Kraken {
  /**
   * Initializes the Kucoin API client with the provided credentials and service configuration.
   * If any credential is provided, all credentials (apiKey, apiSecret, apiPassphrase, apiKeyVersion) must be provided.
   * This setup is necessary for authenticated requests, while public API calls do not require credentials.
   * The `serviceConfig` parameter allows for custom configuration of the client, including logging based on syslog levels.
   *
   * @param {Authentication} [authentication={}] - The API parameters needed for authenticated requests.
   * @param {Object} [serviceConfig={}] - Configuration for additional service features.
   * @param {Logger} [serviceConfig.logger={}] - Logger configuration with methods for different syslog levels.
   * @throws {Error} If some but not all API credentials are provided.
   *
   * @example
   * const kucoinClient = new Kucoin({
   *   apiKey: 'your_api_key',
   *   apiSecret: 'your_api_secret',
   *   apiPassphrase: 'your_api_passphrase',
   *   apiKeyVersion: '2'
   * }, {
   *   onApiCallRateInfo: (info) => console.log(info),
   *   logger: {
   *     emerg: (msg) => console.log(`[EMERGENCY] ${msg}`),
   *     alert: (msg) => console.log(`[ALERT] ${msg}`),
   *     crit: (msg) => console.log(`[CRITICAL] ${msg}`),
   *     error: (msg) => console.log(`[ERROR] ${msg}`),
   *     warning: (msg) => console.log(`[WARNING] ${msg}`),
   *     notice: (msg) => console.log(`[NOTICE] ${msg}`),
   *     info: (msg) => console.log(`[INFO] ${msg}`),
   *     debug: (msg) => console.log(`[DEBUG] ${msg}`),
   *   }
   * })
   */
  constructor(authentication = {}, serviceConfig = {}) {
    // Partial credentials check
    const requiredCredentials = ['apiKey', 'apiSecret']
    const undefinedCount = requiredCredentials.filter(key => authentication[key] === undefined).length
    if (undefinedCount !== 0 && undefinedCount !== requiredCredentials.length) {
      throw new Error(`All API credentials (${requiredCredentials.join(', ')}) must be provided or none at all.`)
    }

    const authenticationToUse = undefinedCount === 0 ? authentication : undefined

    // Ensuring 'logger' is correctly referenced from 'serviceConfig'
    const logger = serviceConfig.logger
    const loggerToUse = {
      emerg: logger?.emerg?.bind(logger) || noop,
      alert: logger?.alert?.bind(logger) || noop,
      crit: logger?.crit?.bind(logger) || noop,
      error: logger?.error?.bind(logger) || noop,
      warning: logger?.warning?.bind(logger) || noop,
      notice: logger?.notice?.bind(logger) || noop,
      info: logger?.info?.bind(logger) || noop,
      debug: logger?.debug?.bind(logger) || noop,
    }

    const serviceConfigToUse = {
      ...serviceConfig,
      logger: loggerToUse,
    }

    // Instantiate wrapper classes with either the complete credentials or undefined
    this.rest = new RestWrapper(authenticationToUse, serviceConfigToUse)
    this.ws = createWebSocketClient(authenticationToUse, serviceConfigToUse)

    // Add orderbook manager
    this.orderbook = createOrderbookSubscriptionManager(authenticationToUse, serviceConfigToUse)
  }
}

export default Kraken
