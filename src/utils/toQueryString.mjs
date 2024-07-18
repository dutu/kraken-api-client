/**
 * Converts an object of key-value pairs into a query string.
 *
 * @param {Object} params - The object containing key-value pairs.
 * @return {string} - The query string representing the object's key-value pairs.
 */
export function toQueryString(params) {
  let queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return queryString ? `?${queryString}` : ''
}
