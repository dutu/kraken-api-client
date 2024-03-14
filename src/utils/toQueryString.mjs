/**
 * Converts an object into a URL query string.
 * Each key-value pair in the object is URL-encoded and concatenated with '&' characters.
 *
 * @param {Object} params - The parameters object to be converted into a query string.
 * @returns {string} The URL-encoded query string.
 *
 * @example
 * // returns '?name=JohnDoe&age=30'
 * #toQueryString({ name: 'John Doe', age: 30 })
 */
export function toQueryString(params) {
  let queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return queryString ? `?${queryString}` : ''
}
