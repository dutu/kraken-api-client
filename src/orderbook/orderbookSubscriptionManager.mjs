import EventEmitter from 'eventemitter3'
import { OrderbookManager } from './orderbookManager.mjs'

/**
 * Creates and manages a subscriptions for orderbookManagers.
 */
export function createOrderbookSubscriptionManager(serviceConfig) {
  return new OrderbookSubscriptionManager(serviceConfig)
}

class OrderbookSubscriptionManager extends EventEmitter {
  #orderbookManagers
  #depth
  #serviceConfig
  constructor(serviceConfig) {
    super()
    this.#serviceConfig = serviceConfig
  }

  /**
   * Subscribes to orderbook updates for a given list of symbols and market and orderbook depth.
   *
   * @param {Object} param0 - Configuration object for subscription.
   * @param {string} param0.symbol - The list of symbols of the orderbook to subscribe to (e.g., ['BTC/USD', 'BTC/EUR']).
   * @param {number} [param0.depth] - The maximum number of orderbook entries to return in each update If parameter is not specified, the full orderbook is returned.
   *
   */
  subscribe({ symbol, depth }) {
    if (this.#orderbookManagers !== undefined) {
      throw new Error('Can only subscribe once')
    }

    this.#validateSymbols(symbol)
    this.#depth = depth
    this.#orderbookManagers = {}
    for (const symb of symbol) {
      this.#orderbookManagers[symb] = new OrderbookManager({ symbol: symb }, this.#serviceConfig )
      this.#orderbookManagers[symb].on('orderbook', this.#onOrderbook)
    }
  }

  /**
   * Unsubscribes from orderbook updates for a list of symbols .
   *
   * @param {Object} param0 - Configuration object for unsubscription.
   * @param {[string]} param0.symbol - The list of symbols of the orderbook to unsubscribe from.
   * @throws {Error} Throws an error if a symbol has not been subscribed for
   */
  unsubscribe({ symbol }) {
    for (const symb of symbol) {
      if (!Object.hasOwn(this.#orderbookManagers,symb)){
        throw new Error(`Subscription for symbol ${symb} does not exist`)
      }

      this.#orderbookManagers[symb].destroy()
    }
  }

  #onOrderbook = (data, { minModifiedIndex } = {}) => {
    if (data === undefined) {
      this.emit('orderbook', undefined)
      return
    }

    if (minModifiedIndex < this.#depth) {
      this.emit('orderbook', {
        asks: data.asks.slice(0, this.#depth),
        bids: data.bids.slice(0, this.#depth),
        symbol: data.symbol,
        timestamp: data.timestamp,
      })
    }
  }

  #validateSymbols(symbol) {
  }
}
