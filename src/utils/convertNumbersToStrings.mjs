/**
 * Recursively converts all numerical values within an object or array to strings.
 * This function is particularly useful for preparing JSON payloads for APIs that
 * require numerical values to be represented as strings to preserve precision.
 *
 * @param {Object|Array} obj - The object or array to convert. This can be a deeply nested structure.
 * @returns {Object|Array} A new object or array with all numerical values converted to strings.
 *
 * @example
 * // Convert an object with nested structures
 * const input = {
 *   id: 123,
 *   details: {
 *     price: 10.99,
 *     count: 3
 *   },
 *   tags: [1, 2, 3]
 * }
 *
 * const converted = convertNumbersToStrings(input)
 * // Output will be:
 * // {
 * //   id: "123",
 * //   details: {
 * //     price: "10.99",
 * //     count: "3"
 * //   },
 * //   tags: ["1", "2", "3"]
 * // }
 */
export function convertNumbersToStrings(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertNumbersToStrings)
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'number' ? value.toString() : convertNumbersToStrings(value)
      return acc
    }, {})
  }

  return obj
}
