import EventEmitter from 'eventemitter3'
import { createWebSocketClient } from '../webSocket/webSocketClient.mjs'
import { calculateChecksum } from './calculateChecksum.mjs'

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
  #depth
  #instrument
  #log
  #webSocketClient
  #orderbook = undefined
  #isActive = true
  #minModifiedIndex

  constructor({ symbol, depth = 1000 }, serviceConfig) {
    super()
    this.#symbol = symbol
    this.#depth = depth
    this.#log = serviceConfig.logger
    this.#webSocketClient = createWebSocketClient(undefined, serviceConfig)
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
    this.#webSocketClient.book
      .unsubscribe({
        symbol: [this.#symbol],
        depth: this.#depth,
      })
    this.#webSocketClient.instrument
      .unsubscribe({
        symbol: [this.#symbol],
      })
    this.#webSocketClient.close()
    this.#webSocketClient = null
    this.#orderbook = undefined
  }

  /*
   * Initiate a WebSocket client to receive orderbook updates
   */
  async #setupWebSocketClient() {
    this.#webSocketClient.on('open', () => {
      this.#log.debug(`Kraken orderbook WebSocket open.`)
      this.#instrument = undefined
      this.#orderbook = undefined
    })

    this.#webSocketClient.on('error', (data) => {
      this.#log.debug(`Kraken orderbook WebSocket error:\n ${JSON.stringify(data, null, 2)}`)
    })

    this.#webSocketClient.on('close', () => {
      this.#log.debug(`Kraken orderbook WebSocket closed.`)
      this.#orderbook = undefined
      this.emit('orderbook', undefined)
    })

    this.#webSocketClient.instrument
      .on('subscribe', (data) => {})
      .on('unsubscribe', (data) => {})
      .on('snapshot', (data) => this.#updateInstrument(data))
      .on('update', (data) => this.#updateInstrument(data))
      .subscribe({
        snapshot: true,
        symbol: [this.#symbol],
      })

    this.#webSocketClient.book
      .on('subscribe', (data) => {})
      .on('unsubscribe', (data) => {})
      .on('snapshot', (data) => this.#onOrderbookSnapshot(data))
      .on('update', (data) => this.#onOrderbookUpdate(data))
      .subscribe({
        snapshot: true,
        symbol: [this.#symbol],
        depth: this.#depth,
      })
  }

  #updateInstrument(data) {
    if ((data.type === 'snapshot' || data.type === 'update') && Array.isArray(data.data?.pairs)) {
      const instrumentFirstTimeUpdate = this.#instrument === undefined
      this.#instrument = data.data.pairs.find((instrument) => instrument.symbol === this.#symbol)

      // Check if we update instrument data first time after the WebSocket is open
      if (instrumentFirstTimeUpdate) {
        // If yes, we need to mark the entire orderbook as new
        this.#minModifiedIndex = 0
        this.#verifyChecksumAndEmitOrderbook()
      }
    }
  }

  async #onOrderbookSnapshot(data) {
    this.#orderbook = data.data[0]
    this.#orderbook.timestamp = new Date().toISOString()
    this.#minModifiedIndex = 0
    this.#verifyChecksumAndEmitOrderbook()
  }

  async #onOrderbookUpdate(data) {
    if (!this.#orderbook || !this.#isActive) {
      return
    }

    this.#applyUpdates(data)
    this.#verifyChecksumAndEmitOrderbook()
  }

  #verifyChecksumAndEmitOrderbook() {
    // Check if we have received instrument data, the orderbook, and the orderbook manager is active
    if (!(this.#instrument && this.#orderbook && this.#isActive)) {
      // If not, we cannot calculate the checksum. We will not emit the orderbook
      return
    }

    let checksum = calculateChecksum({
      asks : this.#orderbook.asks,
      bids: this.#orderbook.bids,
      pricePrecision: this.#instrument.price_precision,
      qtyPrecision: this.#instrument.qty_precision,
    })

    // Check if we have a valid checksum
    if (checksum === this.#orderbook.checksum) {
      // Check if orderbook has been modified
      if (this.#minModifiedIndex !== undefined) {
        this.emit('orderbook', this.#orderbook, { minModifiedIndex: this.#minModifiedIndex })
      }
    } else {
      this.#log.info(`Error: Kraken orderbook checksum mismatch. Expected ${this.#orderbook.checksum}, calculated ${checksum}.`)
      this.#minModifiedIndex = 0
      this.#orderbook = undefined
      this.#webSocketClient.refresh()
    }
  }

  /*
   * Applies a change to the order book.
   * Updates the specified side ('asks' or 'bids') by adding, updating, or deleting an order.
   * Orders are kept sorted by price. A size of '0' indicates that the order should be removed.
   *
   * Params:
   * - change: Object containing { side, price, qty }
   * Returns:
   * - index: The index position where the applied into the orderbook asks or bids, or undefined if there was no change
   */
  #applyChange({ side, price, qty }) {
    const obSide = this.#orderbook[side]
    let index

    if (!this.#orderbook[side]) {
      this.#orderbook[side] = []
    }

    // Find the index where price is less than (for bids) or greater than (for asks) the current price
    // or where the price is exactly equal to handle the update or delete
    index = obSide.findIndex((entry) => {
      return side === 'asks' ? entry.price >= price : entry.price <= price
    })

    if (index !== -1) {
      // If the found price is equal, update or delete
      if (obSide[index].price === price) {
        if (qty === 0) {
          // Size 0 indicates deletion
          obSide.splice(index, 1)
        } else {
          // Update size
          obSide[index].qty = qty
        }
      } else {
        // Price not equal, implies new entry. Insert before the found index for asks, after for bids
        const newEntry = { price, qty }
        obSide.splice(index, 0, newEntry)
      }
    } else {
      // No entry found, or should be added to the end
      const newEntry = { price, qty }
      obSide.push(newEntry)
      index = obSide.length - 1
    }

    return index
  }

  /*
   * Applies updates from WebSocket update message to the order book.
   */
  #applyUpdates(data) {
    this.#minModifiedIndex = undefined
    for (const side of ['asks', 'bids']) {
      const obSide = data.data?.[0]?.[side]
      // Verify that 'asks' or 'bids' are arrays
      if (!Array.isArray(obSide)) {
        // If not, the orderbook update message is invalid
        this.#log.debug(`Error: Kraken orderbook update message is invalid:\n${JSON.stringify(data, null, 2)}`)
        this.#webSocketClient.refresh()
      }

      for(const change of obSide) {
        const modifiedIndex = this.#applyChange({...change, side })

        // Update minModifiedIndex only if modifiedIndex is defined and either minModifiedIndex is undefined or modifiedIndex is smaller
        if (modifiedIndex !== undefined && (this.#minModifiedIndex === undefined || modifiedIndex < this.#minModifiedIndex)) {
          this.#minModifiedIndex = modifiedIndex
        }
      }

      // Truncates the array to contain no more than `this.#depth` elements
      this.#orderbook[side].length = Math.min(this.#depth, this.#orderbook[side].length)
    }

    this.#orderbook.checksum = data.data[0].checksum
    this.#orderbook.timestamp = data.data[0].timestamp
  }
}
