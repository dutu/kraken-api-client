/**
 * Creates a nonce generator that produces a unique nonce by using a Unix timestamp in milliseconds
 * multiplied by 1000 and adds a counter if the generated nonce is equal to the previous one.
 * @returns {Function} A function that when called, returns a unique nonce.
 *
 * @example
 * const getNonce = createNonceGenerator();
 * console.log(generateNonce()) // 16502928450000 (example output)
 * console.log(generateNonce()) // 16502928450001 (example output if called immediately after)
 */
export const createNonceGenerator = function createNonceGenerator() {
  let lastNonce = 0
  let counter = 0

  const generateNonce = function generateNonce() {
    const currentNonce = Date.now() * 1000
    if (currentNonce <= lastNonce) {
      counter += 1
      lastNonce += counter
    } else {
      lastNonce = currentNonce
      counter = 0
    }

    return lastNonce
  }

  return generateNonce
}
