import crypto from 'crypto'
import axios from 'axios'
import { toQueryString } from '../utils/toQueryString.mjs'

export class BaseWrapper {
  #authentication
  #log
  #client
  #baseURLs = {
    production: `https://api.kraken.com`,
  }

  constructor({ apiKey, apiSecret, nonce, otp } = {}, { logger }) {
    this.#authentication = { apiKey, apiSecret, nonce, otp }
    this.#log = logger
    this.#client = axios.create()
  }

  /**
   * Performs an HTTP request to the specified endpoint with given parameters.
   * Supports adding authentication headers for protected endpoints and provides
   * mechanisms for accessing rate limit information either through a callback or an event.
   *
   * @param {Object} config - Configuration for the request.
   * @param {string} config.endpoint - The API endpoint.
   * @param {string} config.method - The HTTP method (GET, POST, PUT, DELETE, PATCH).
   * @param {string} config.baseUrl - The base URL key for determining the full URL.
   * @param {boolean} [config.requiresAuth=false] - Indicates if the request requires authentication.
   * @param {Object} [config.params={}] - The parameters for the request.
   * @throws {Error} If an unsupported HTTP method is used or if authentication is required but the API key is missing.
   *
   * Example:
   * ```
   * apiWrapper.makeRequest({
   *   endpoint: '/example',
   *   method: 'GET',
   *   baseUrl: 'https://api.example.com',
   *   requiresAuth: true,
   * })
   * ```
   */
  async makeRequest({ endpoint, method, baseUrl, requiresAuth = false, params = {} }) {
    const supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

    if (!supportedMethods.includes(method)) {
      throw new Error(`HTTP method '${method}' is not supported.`)
    }

    // Error if authentication is required but no API key is provided
    if (requiresAuth && !this.#authentication.apiKey) {
      throw new Error('Authentication is required, but no API key was provided.')
    }

    const { baseEndpoint, queryParams } = this.#prepareEndpoint(endpoint, params)

    const axiosConfig = {
      method,
      url: `${this.#baseURLs[baseUrl]}${baseEndpoint}`,
      headers: {},
      timeout: 5000,
    }

    // Include params as 'params' for GET and DELETE, 'data' for others
    let data
    if (['GET', 'DELETE'].includes(method)) {
      axiosConfig.params = queryParams
      data = toQueryString(queryParams)
    } else {
      axiosConfig.data = queryParams
      data = JSON.stringify(queryParams)
    }

    if (requiresAuth) {
      const timestamp = Date.now().toString()
      const strToSign = `${timestamp}${method}${baseEndpoint}${data}`
      const sign = crypto.createHmac('sha256', this.#authentication.apiSecret).update(strToSign).digest('base64')

      axiosConfig.headers['KC-API-KEY'] = this.#authentication.apiKey
      axiosConfig.headers['KC-API-SIGN'] = sign
      axiosConfig.headers['KC-API-TIMESTAMP'] = timestamp
      axiosConfig.headers['Content-Type'] = 'application/json'

      if (this.#authentication.apiKeyVersion.toString() === '2') {
        axiosConfig.headers['KC-API-PASSPHRASE'] = crypto.createHmac('sha256', this.#authentication.apiSecret).update(this.#authentication.apiPassphrase).digest('base64')
        axiosConfig.headers['KC-API-KEY-VERSION'] = 2
      }
    }

    let response
    try {
      response = await axios(axiosConfig)
      if (!(response.status === 200 && response.data?.code === '200000')) {
        throw new Error(`${response.data?.code || response.status}: ${response.data?.msg || response.statusText}`)
      }
    } catch (error) {
      throw new Error(error.response ? `${error.response.status}: ${error.response.statusText}` : error.message)
    }

    return response.data
  }

  /**
   * Prepares the API endpoint by replacing path placeholders with actual values from `params`.
   * Throws an error if `params` does not include all variables required in the endpoint.
   *
   * @param {string} endpoint - The API endpoint template with path placeholders.
   * @param {Object} params - The parameters object containing both path variable values and query parameters.
   * @returns {{baseEndpoint: string, queryParams: Object}} An object containing the base endpoint with replaced path placeholders and query parameters.
   */
  #prepareEndpoint(endpoint, params) {
    let baseEndpoint = endpoint
    const queryParams = {}

    Object.entries(params).forEach(([key, value]) => {
      // Check and replace path placeholders
      const pathPlaceholder = `{${key}}`
      if (baseEndpoint.includes(pathPlaceholder)) {
        baseEndpoint = baseEndpoint.replace(pathPlaceholder, encodeURIComponent(value))
      } else {
        queryParams[key] = value // Collect as query parameter
      }
    })

    // After replacing, check if any path placeholders are left unreplaced
    const remainingPathPlaceholders = baseEndpoint.match(/\{([^}]+)\}/g)
    if (remainingPathPlaceholders) {
      throw new Error(`Missing values for parameters: ${remainingPathPlaceholders.join(", ")}`)
    }

    return { baseEndpoint, queryParams }
  }

  /**
   * Signs a message using HMAC-SHA256 with the API secret and encodes it in base64.
   *
   * @param {string} message - The message to be signed.
   * @returns {string} The base64-encoded signature.
   */
  #signMessage(message) {
    return crypto.createHmac('sha256', this.#authentication.apiSecret)
      .update(message)
      .digest('base64')
  }

  /**
   * Generates authentication headers for Kucoin API requests.
   *
   * @param {string} endpoint - The API endpoint.
   * @param {string} method - The HTTP method (GET, POST, etc.).
   * @param {string} [body=""] - The request body for POST requests.
   * @returns {Object} The required headers for authenticated API requests.
   */
  #getAuthHeaders(path, request, nonce) {
    const message       = qs.stringify(request)
    const secret_buffer = new Buffer(this.#authentication.apiKey, 'base64')
    const hash          = new crypto.createHash('sha256')
    const hmac          = new crypto.createHmac('sha512', secret_buffer)
    const hash_digest   = hash.update(nonce + message).digest('binary')
    const hmac_digest   = hmac.update(path + hash_digest, 'binary').digest('base64')

    return {
      'API-Key': this.#authentication.apiKey,
      'API-Sign': signature,
    }
  }
}
