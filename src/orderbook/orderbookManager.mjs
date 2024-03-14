import EventEmitter from 'eventemitter3'
import { createWebSocketClient } from '../webSocket/webSocketClient.mjs'
import { createPolynomialBackoff } from '../utils/backoff.mjs'
import { findIndexReverse } from '../utils/findIndexReverse.mjs'
import { RestWrapper } from '../rest/restWrapper.mjs'

const Fields = {
  price: 0,
  size: 1,
  seq: 2,
  side: 3,
  time: 4,
}

const BaseTopic = {
  spot: '/market/level2:',
  futures: '/contractMarket/level2:',
}

/**
 * Manages and maintains a real-time order book for a given symbol and market (spot or futures) by
 * interacting with WebSocket and REST endpoints. It subscribes to order book updates via WebSocket,
 * requests snapshots to ensure data integrity, and emits events to signal order book changes.
 *
 * @class OrderbookManager
 * @extends EventEmitter
 *

 * Public Methods:
 * - `setActiveState(value: boolean)`: Activates or deactivates the order book updates.
 * - `destroy()`: Cleans up resources, unsubscribes from updates, and prepares the instance for disposal.
 *
 * Properties:
 * - `isActive`: Indicates whether the OrderbookManager is currently active and subscribing to updates.
 *
 * Events:
 * - `orderbook`: Emitted whenever the order book is updated with a new state.
 *
 * Example:
 * ```javascript
 * const orderbookManager = new OrderbookManager({
 *   symbol: 'BTC-USDT',
 *   market: 'spot',
 *   activeState: true
 * }, credentials, serviceConfig)
 *
 * orderbookManager.on('orderbook', (orderbook) => {
 *   console.log('Updated orderbook:', orderbook)
 * })
 * ```
 */
export class OrderbookManager extends EventEmitter {
  #symbol
  #market
  #log
  #webSocketClient
  #isRequestSnapshotInProgress = false
  #cacheSortedBySequence = []
  #orderbook = undefined
  #backoff
  #rest
  #isActive = true

  constructor({ symbol, market }, credentialsToUse, serviceConfigToUse) {
    super()
    this.#symbol = symbol
    this.#market = market
    this.#log = serviceConfigToUse.logger

    this.#backoff = createPolynomialBackoff({ minValue: 50, maxValue: 10000, degree: 3 })

    this.#rest = new RestWrapper(credentialsToUse, serviceConfigToUse)
    this.#webSocketClient = createWebSocketClient(credentialsToUse, serviceConfigToUse, market)
    this.#setupWebSocketClient()

    this.#webSocketClient.connect()
  }

  /**
   * Cleans up resources and internal state of the Orderbook instance.
   * This method unsubscribes from the current WebSocket feed, closes the WebSocket connection,
   * and resets the internal properties to their default states. It should be called when the
   * Orderbook instance is no longer needed or before creating a new instance to avoid memory leaks
   * and ensure proper release of resources.
   */
  destroy() {
    this.#isActive = false
    this.emit('orderbook', undefined)

    const subscription = {
      type: 'unsubscribe',
      topic: BaseTopic[this.#market] + this.#symbol,
      response: true,
    }

    this.#webSocketClient.unsubscribe(subscription, this.#applyWebSocketUpdate)
    this.#webSocketClient.close()
    this.#webSocketClient = null
    this.#cacheSortedBySequence = []
    this.#orderbook = undefined
  }

  /*
   * Initiate a WebSocket client to receive orderbook updates
   */
  #setupWebSocketClient() {
    const subscription = {
      type: 'subscribe',
      topic: BaseTopic[this.#market] + this.#symbol,
      response: true,
    }

    this.#webSocketClient.subscribe(subscription, this.#applyWebSocketUpdate)

    this.#webSocketClient.on('open', () => {
      this.#requestSnapshot()
    })

    this.#webSocketClient.on('close', () => {
      this.#orderbook = undefined
      this.emit('orderbook', undefined)
      this.#log.notice(`Orderbook ${this.#symbol} not available`)
    })
  }

  async #requestSnapshot() {
    if (this.#isRequestSnapshotInProgress) return
    this.#isRequestSnapshotInProgress = true
    this.#orderbook = undefined
    this.emit('orderbook', undefined)
    while (this.#isActive) {
      try {
        const result = await this.#rest.getFullOrderBook({ symbol: this.#symbol })
        this.#orderbook = result.data
        // Check if we hava overlap between orderbook snapshot and cached updates
        if (this.#cacheSortedBySequence[0] && Number(this.#cacheSortedBySequence[0][Fields.seq]) < Number(this.#orderbook.sequence)) {
          // if overlap we stop trying to get new snapshots
          break
        }
      } catch (e) {
        this.#log.notice(e.message)
      }

      await this.#backoff.delay()
    }

    if (this.#isActive) {
      this.#isRequestSnapshotInProgress = false
      this.#backoff.reset()
      const res = this.#applyChangesFromCacheAndEmitOrderbook()
      if (res) {
        this.#log.info(`Orderbook ${this.#symbol} available and synchronized at sequence ${res.synchronizedAtSequence}`)
      }
    }
  }

  /*
   * Adds a 'change' object to the cache array, which is sorted by the sequence number in ascending order.
   */
  #addChangeToCache(change) {
    const cache = this.#cacheSortedBySequence
    const sequence = Number(change[Fields.seq])

    // Find the position from the end where the change's sequence is just larger than the next item's sequence
    let positionToInsert = findIndexReverse(cache,(item) => Number(item[Fields.seq]) < sequence)

    // Add the change to the cache at the calculated position (increment position to insert after it)
    cache.splice(positionToInsert + 1, 0, change)
  }


  /*
   * Applies a change to the order book.
   * Updates the specified side ('asks' or 'bids') by adding, updating, or deleting an order.
   * Orders are kept sorted by price. A size of '0' indicates that the order should be removed.
   *
   * Params:
   * - change: Object containing [price, size, seq, side]
   * Returns:
   * - index: The index position where the applied into the orderbook asks or bids, or undefined if there was no change
   */
  #applyChange(change) {
    const side = change[Fields.side]
    const obSide = this.#orderbook[side]
    const price = Number(change[Fields.price])
    const size = change[Fields.size]
    const sequence = change[Fields.seq]
    let index

    if (!this.#orderbook[side]) {
      this.#orderbook[side] = []
    }

    // Check if the price is 0
    if (price === 0) {
      // Ignore the messages and update the sequence
      this.#orderbook.sequence = sequence
      this.#orderbook.time = change[Fields.time]
      return undefined
    }

    // Find the index where price is less than (for bids) or greater than (for asks) the current price
    // or where the price is exactly equal to handle the update or delete
    index = obSide.findIndex((entry) => {
      return side === 'asks' ? Number(entry[Fields.price]) >= price : Number(entry[Fields.price]) <= price
    })

    if (index !== -1) {
      // If the found price is equal, update or delete
      if (Number(obSide[index][Fields.price]) === price) {
        if (Number(size) === 0) {
          // Size 0 indicates deletion
          obSide.splice(index, 1)
        } else {
          // Update size
          obSide[index][Fields.size] = size
        }
      } else {
        // Price not equal, implies new entry. Insert before the found index for asks, after for bids
        const newEntry = [change[Fields.price], size]
        obSide.splice(index, 0, newEntry)
      }
    } else {
      // No entry found, or should be added to the end
      const newEntry = [change[Fields.price], size]
      obSide.push(newEntry)
      index = obSide.length - 1
    }

    this.#orderbook.sequence = sequence
    this.#orderbook.time = change[Fields.time]
    return index
  }

  #applyChangesFromCacheAndEmitOrderbook() {
    if (!this.#orderbook || !this.#isActive) {
      return
    }

    let synchronizedAtSequence
    let minModifiedIndex
    for (const change of this.#cacheSortedBySequence) {
      // Check if outdated change
      if (Number(change[Fields.seq]) > Number(this.#orderbook.sequence)) {
        // Only apply not-outdated change
        synchronizedAtSequence ??= change[Fields.seq]
        const modifiedIndex = this.#applyChange(change)

        // Update minModifiedIndex only if modifiedIndex is defined and either minModifiedIndex is undefined or modifiedIndex is smaller
        if (modifiedIndex !== undefined && (minModifiedIndex === undefined || modifiedIndex < minModifiedIndex)) {
          minModifiedIndex = modifiedIndex
        }
      }
    }

    // Empty cache after processing
    this.#cacheSortedBySequence = []

    if (minModifiedIndex !== undefined) {
      this.emit('orderbook', this.#orderbook, { minModifiedIndex })
    }

    return synchronizedAtSequence ? { synchronizedAtSequence } : undefined
  }

  /*
   * Applies changes from an WebSocket update message to the order book.
   * (Use arrow function, so we can always run it in "this" context
   */
  #applyWebSocketUpdate = (update) => {
    if (!this.#isActive) {
      return
    }

    if (update.type === 'ack') {
      this.#log.info(`WebSocket[${this.#webSocketClient.connectId}] subscribed to orderbook:${this.#symbol}`)
      return
    }

    if (update.subject !== 'trade.l2update') {
      // Filter out irrelevant messages
      return
    }

    // Add updates to cache
    for (const side of ['asks', 'bids']) {
      for (const change of update.data.changes[side]) {
        this.#addChangeToCache([...change, side, update.data.time])
      }
    }

    // Check if we have a valid orderbook
    if (this.#orderbook) {
      this.#applyChangesFromCacheAndEmitOrderbook()
    }
  }
}
