/**
 * Generates a unique numerical ID by calculating the milliseconds elapsed since the start of the current year
 * and appending a random part. This method aims to produce a more compact numerical value while retaining uniqueness.
 * @returns {number} A unique numerical ID.
 * @example
 * const id = uniqueId();
 * console.log(id);
 */
export function uniqueId() {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1) // First moment of the current year
  const millisecondsSinceYearStart = now - startOfYear // Difference in milliseconds
  const randomPart = Math.floor(Math.random() * 1000) // Random number between 0 and 999

  // Combine randomPart and millisecondsSinceYearStart, with randomPart leading
  return Number(`${randomPart}${millisecondsSinceYearStart}`)
}
