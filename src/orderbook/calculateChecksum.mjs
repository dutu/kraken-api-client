import crc32 from 'crc-32'

/**
 * Computes the CRC32 checksum for the top 10 asks and bids of an order book, using specified precision for price and quantity.
 * @param {Object} params - The parameters object.
 * @param {Object[]} params.asks - The list of ask orders.
 * @param {Object[]} params.bids - The list of bid orders.
 * @param {number} params.pricePrecision - The number of decimal places to use for price.
 * @param {number} params.qtyPrecision - The number of decimal places to use for quantity.
 * @returns {number} The computed CRC32 checksum.
 * @example
 * const orderBook = {
 *   asks: [
 *     {price: 34726.4, qty: 0.25},
 *     {price: 34727.7, qty: 0.21},
 *     // more asks...
 *   ],
 *   bids: [
 *     {price: 34717.6, qty: 0.13},
 *     {price: 34714.1, qty: 0.08572098},
 *     // more bids...
 *   ],
 *   pricePrecision: 6,
 *   qtyPrecision: 8
 * }
 * console.log(calculateChecksum(orderBook))
 */
export function calculateChecksum({ asks, bids, pricePrecision, qtyPrecision }) {
  // Convert a price-quantity pair to the specified format
  const convertPair = (price, qty) => {
    let priceStr = price.toFixed(pricePrecision).replace('.', '').replace(/^0+/, '')
    let qtyStr = qty.toFixed(qtyPrecision).replace('.', '').replace(/^0+/, '')
    return priceStr + qtyStr
  }

  // Process asks and bids
  const processList = (list, isAsk = true) => {
    return list
      .sort((a, b) => isAsk ? a.price - b.price : b.price - a.price)
      .slice(0, 10)
      .map((order) => convertPair(order.price, order.qty))
      .join('')
  }

  const asksString = processList(asks, true)
  const bidsString = processList(bids, false)
  const combinedString = asksString + bidsString

  // Compute CRC32 checksum
  const checksum = crc32.str(combinedString)

  // Return unsigned 32-bit integer checksum
  return checksum >>> 0
}
