import crypto from 'crypto'
import axios from 'axios'
import { toQueryString } from '../utils/toQueryString.mjs'
import { createNonceGenerator } from './nonceGenerator.mjs'

/**
 * Creates authentication signature.
 *
 * @param {string} path - The request path.
 * @param {string} message - The message to be authenticated.
 * @param {string} secret - The secret key, base64 encoded.
 * @param {string} nonce - A unique value for the request.
 * @returns {string} - The HMAC digest as a base64 encoded string.
 *
 * @example
 * const path = '/api/v1/orders';
 * const message = '{"order_id": 123456}';
 * const secret = 'MjVkMjQyZDEwZjE2ZDhlMmJhZTI='; // Example base64 encoded secret
 * const nonce = '1588394368';
 * const signature = createAuthenticationSignature(path, message, secret, nonce);
 * console.log(signature); // Logs the HMAC digest in base64 format.
 */
const createAuthenticationSignature = function createAuthenticationSignature(path, message, secret, nonce)  {
  const secretBuffer = Buffer.from(secret, 'base64')
  const hashDigest = crypto.createHash('sha256')
    .update(nonce + message)
    .digest('binary')
  const hmacDigest = crypto.createHmac('sha512', secretBuffer)
    .update(path + hashDigest, 'binary')
    .digest('base64')
  return hmacDigest
}

export class BaseWrapper {
  #authentication
  #log
  #client
  #baseURLs = {
    production: `https://api.kraken.com`,
  }

  constructor({ apiKey, apiSecret, generateNonce = createNonceGenerator(), generateOtp } = {}, { logger }) {
    this.#authentication = { apiKey, apiSecret, generateNonce, generateOtp }
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

    const { queryEndpoint, queryParams } = this.#prepareEndpoint(endpoint, params)

    const axiosConfig = {
      method,
      url: `${this.#baseURLs[baseUrl]}${queryEndpoint}`,
      headers: {},
      timeout: 5000,
    }

    if(requiresAuth) {
      queryParams.nonce = this.#authentication.generateNonce()
      if (this.#authentication.generateOtp) {
        queryParams.otp = this.#authentication.generateOtp()
      }
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
      const sign = createAuthenticationSignature(
        queryEndpoint,
        data,
        this.#authentication.apiSecret,
        queryParams.nonce
      )

      axiosConfig.headers['API-Key'] = this.#authentication.apiKey
      axiosConfig.headers['API-Sign'] = sign
    }

    let response
    try {
      response = await axios(axiosConfig)
      if (Array.isArray(response.data?.error) && response.data.error.length > 0) {
        throw new Error(response.data.error.join(', '))
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
   * @returns {{queryEndpoint: string, queryParams: Object}} An object containing the base endpoint with replaced path placeholders and query parameters.
   */
  #prepareEndpoint(endpoint, params) {
    let queryEndpoint = endpoint
    const queryParams = {}

    Object.entries(params).forEach(([key, value]) => {
      // Check and replace path placeholders
      const pathPlaceholder = `{${key}}`
      if (queryEndpoint.includes(pathPlaceholder)) {
        queryEndpoint = queryEndpoint.replace(pathPlaceholder, encodeURIComponent(value))
      } else {
        queryParams[key] = value // Collect as query parameter
      }
    })

    // After replacing, check if any path placeholders are left unreplaced
    const remainingPathPlaceholders = queryEndpoint.match(/\{([^}]+)\}/g)
    if (remainingPathPlaceholders) {
      throw new Error(`Missing values for parameters: ${remainingPathPlaceholders.join(", ")}`)
    }

    return { queryEndpoint, queryParams }
  }
}
