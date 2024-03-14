/**
 * Creates a backoff object with delay and reset methods using a polynomial backoff sequence.
 *
 * @param {Object} config Configuration object for the backoff.
 * @param {number} config.minValue The initial and minimum delay value in milliseconds.
 * @param {number} config.maxValue The maximum delay value in milliseconds.
 * @param {number} config.degree The degree of the polynomial for the backoff sequence.
 * @returns {Object} The backoff object with delay and reset methods.
 */
export function createPolynomialBackoff({ minValue, maxValue, degree }) {
  const generateSequence = polynomialGenerator(degree)
  const sequence = generateSequence(minValue, maxValue)
  let currentIndex = 0

  /**
   * Waits for the current delay in the polynomial sequence, then moves to the next delay.
   * @returns {Promise<void>} A promise that resolves after the delay.
   */

  async function delay() {
    const currentDelay = sequence[Math.min(currentIndex, sequence.length - 1)]
    await new Promise(resolve => setTimeout(resolve, currentDelay))
    currentIndex += 1
  }

  /**
   * Resets the delay back to the initial (minimum) value in the sequence.
   */
  function reset() {
    currentIndex = 0
  }

  return {
    delay,
    reset,
  }
}

/**
 * Generates a polynomial backoff sequence.
 * @param {number} degree - The degree of the polynomial.
 * @returns {Function} A function that generates a polynomial sequence.
 */
function polynomialGenerator(degree) {
  function generateSequence(minDelay, maxDelay) {
    let sequence = [minDelay]
    let i = Math.pow(minDelay, 1 / degree)
    while (true) {
      i += 1
      let delay = Math.pow(i, degree)
      if (delay > maxDelay) {
        sequence.push(maxDelay)
        break
      }
      sequence.push(delay)
    }

    return sequence
  }

  return generateSequence
}
