import EventEmitter from 'eventemitter3'
import { OrderbookManager } from './orderbookManager.mjs'

/**
 * Creates and manages a subscriptions for orderbookManagers.
 */
export function createOrderbookSubscriptionManager(serviceConfig) {
  return new OrderbookSubscriptionManager(serviceConfig)
}

class OrderbookSubscriptionManager extends EventEmitter {
  #orderbookManagers = {}
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
    this.#validateSymbols(symbol)
    this.#depth = depth
    for (const symb of symbol) {
      if (!this.#orderbookManagers[symb]) {
        this.#orderbookManagers[symb] = new OrderbookManager({ symbol: symb }, this.#serviceConfig )
        this.#orderbookManagers[symb].on('orderbook', this.#onOrderbook)
      }
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
