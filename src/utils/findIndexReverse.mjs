/**
 * Finds the index of the first element in the array that satisfies the provided testing function, searching backwards.
 * @param {Array} arr - The array to search.
 * @param {Function} callback - The function to execute on each value in the array.
 * @returns {number} The index of the first element that satisfies the testing function; otherwise, -1.
 * @example
 * const arr = [5, 12, 8, 130, 44];
 * const isLargeNumber = (element) => element > 13;
 * console.log(findIndexReverse(arr, isLargeNumber)); // Outputs: 3
 */
export function findIndexReverse(arr, callback) {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (callback(arr[i], i, arr)) {
      return i
    }
  }

  return -1
}
