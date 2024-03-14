import { OrderbookManager } from './orderbookManager.mjs'

/**
 * Creates and manages a subscriptions for orderbookManagers.
 *
 * @example
 * const manager = createOrderbookSubscriptionManager()
 * let callback = (data) => console.log(data)
 * manager.subscribe({ symbol: 'BTCUSD' }, callback)
 * manager.unsubscribe({ symbol: 'BTCUSD' }, callback)
 */
export function createOrderbookSubscriptionManager(credentialsToUse, serviceConfigToUse) {
  const orderbookManagers = {
    spot: {},
    futures: {},
  }

  const depthLimitedCallbacks = {}

  function generateSubscriptionKey(symbol, market, depth) {
    return `${market}:${symbol}:${depth}`
  }

  const validateMarket = function validateMarket(market) {
    if (!(market === 'spot' || market === 'futures')) {
      throw new Error('market must be "spot" or "futures"')
    }
  }

  /**
   * Subscribes to orderbook updates for a given symbol and market and orderbook depth.
   *
   * @param {Object} param0 - Configuration object for subscription.
   * @param {string} param0.symbol - The symbol of the orderbook to subscribe to (e.g., 'BTCUSD').
   * @param {'spot' | 'futures'} [param0.market='spot'] - The market type of the orderbook (either 'spot' or 'futures').
   * @param {number} [param0.depth] - The maximum number of orderbook entries to return in each update If parameter is not specified, the full orderbook is returned.
   * @param {Function} callback - Function to call with orderbook updates. Receives the updated data as its argument.
   *
   */
  function subscribe({ symbol, market = 'spot', depth, }, callback) {
    validateMarket(market)

    // Create a new Orderbook Manager only if one doesn't exist already for this symbol
    orderbookManagers[market][symbol] ??= new OrderbookManager({ symbol, market }, credentialsToUse, serviceConfigToUse )

    const subscriptionKey = generateSubscriptionKey(symbol, market, depth)
    // Check if a modified callback exists for these parameters, otherwise create one and add it as listener
    if (!depthLimitedCallbacks[subscriptionKey]) {
      depthLimitedCallbacks[subscriptionKey] = (orderbook, params) => {
        if (!orderbook) {
          callback(orderbook)
        } else {
          if (params.minModifiedIndex <= depth ) {
            const depthLimitedOrderbook = {
              sequence: orderbook.sequence,
              time: orderbook.time,
              asks: orderbook.asks.slice(0, depth),
              bids: orderbook.bids.slice(0, depth)
            }

            callback(depthLimitedOrderbook)
          }
        }
      }

      const depthLimitedCallback =  depthLimitedCallbacks[subscriptionKey]
      orderbookManagers[market][symbol].addListener('orderbook', depthLimitedCallback)
    }
  }

  /**
   * Unsubscribes from orderbook updates for a given symbol, market, and depth.
   * This function removes the specified callback from the orderbook updates. If the callback
   * is associated with a specific depth, it removes the depth-limited callback. After removal,
   * if there are no more listeners for the orderbook of the given symbol and market, it stops
   * the OrderbookManager for that symbol and market and deletes its reference.
   *
   * @param {Object} param0 - Configuration object for unsubscription.
   * @param {string} param0.symbol - The symbol of the orderbook to unsubscribe from (e.g., 'BTCUSD').
   * @param {'spot' | 'futures'} [param0.market='spot'] - The market of the orderbook to unsubscribe from.
   * @param {number} [param0.depth] - The depth of the orderbook entries to unsubscribe from.
   * @param {Function} callback - The callback function that was used for subscription.
   * @throws {Error} Throws an error if the callback is not registered as a listener for the specified
   * orderbook, symbol, market, and depth, indicating that either the subscription key is invalid or
   * the callback was never subscribed.
   *
   * @example
   * const manager = createOrderbookSubscriptionManager();
   * const callback = data => console.log('Orderbook Update:', data);
   * manager.subscribe({ symbol: 'BTCUSD', market: 'spot', depth: 10 }, callback);
   * // Later...
   * manager.unsubscribe({ symbol: 'BTCUSD', market: 'spot', depth: 10 }, callback);
   */
  function unsubscribe({ symbol, market = 'spot', depth }, callback) {
    validateMarket(market)

    const subscriptionKey = generateSubscriptionKey(symbol, market, depth)
    const depthLimitedCallback = depthLimitedCallbacks[subscriptionKey]
    const orderbookManager = orderbookManagers[market][symbol]
    if (depthLimitedCallback) {
      delete depthLimitedCallbacks[subscriptionKey]
      orderbookManager.removeListener('orderbook', depthLimitedCallback)

      // Destroy and dispose the orderbook manager resources when there is no other listener for that symbol
      if (orderbookManager.listenerCount('orderbook') === 0) {
        orderbookManager.destroy()
        delete orderbookManagers[market][symbol]
      }
    } else {
      throw new Error(`Callback is not registered as a listener for orderbook ${market}:${symbol}:${depth}`)
    }
  }
  
  return { subscribe, unsubscribe }
}
