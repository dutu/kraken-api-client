import EventEmitter from 'eventemitter3'
import { uniqueId } from '../utils/uniqueId.mjs'

export const channels = {
  book: 'book',
  executions: 'executions',
  heartbeat: 'heartbeat',
  instrument: 'instrument',
  ohlc: 'ohlc',
  ticker: 'ticker',
  trade: 'trade',
  status: 'status',
}

export const privateSubscriptionChannels = new Set([channels.executions])
export const publicSubscriptionChannels = new Set([channels.book, channels.instrument, channels.ohlc, channels.ticker, channels.trade])


export class ChannelManager extends EventEmitter {
  #channel
  #subscriptionKeys
  #webSocket
  constructor({ channel, webSocket }) {
    super()
    this.#channel = channel
    this.#webSocket = webSocket
  }

  subscribe(params) {
    const { token,  symbol: symbolArray = [], ...subscriptionObject} = params
    this.#validateSymbol(symbolArray)
    const subscriptionKey = JSON.stringify(subscriptionObject)

    if (this.#subscriptionKeys === undefined) {
      this.#webSocket.on('subscribe', this.#onSubscribe)
      this.#webSocket.on('unsubscribe', this.#onUnsubscribe)
      this.#webSocket.on('message', this.#onMessage)
      this.#subscriptionKeys = {}
    }

    this.#subscriptionKeys[subscriptionKey] ??= new Set()
    symbolArray.forEach(symbol => {
      this.#subscriptionKeys[subscriptionKey].add(symbol)
    })

    const subscription = {
      method: 'subscribe',
      params: {
        ...params,
        channel: this.#channel,
      },
    }

    this.sendSubscribe(subscription)
    return this
  }

  unsubscribe(params) {
    const { token,  symbol: symbolArray = [], ...subscriptionObject} = params

    Object.keys(this.#subscriptionKeys).forEach((subscriptionKey) => {
      // Compare unsubscribe object with registered subscriptions, but without the snapshot key
      const registeredKey = JSON.parse(subscriptionKey)
      delete registeredKey.snapshot
      const unsubscribeKey = { ...subscriptionObject }
      delete unsubscribeKey.snapshot
      if (JSON.stringify(registeredKey) === JSON.stringify(unsubscribeKey)) {
        // Remove symbols from the subscription
        symbolArray.forEach(symbol => {
          this.#subscriptionKeys[subscriptionKey].delete(symbol)
        })

        // Check if there is no more symbols in the subscription
        if (this.#subscriptionKeys[subscriptionKey].size === 0) {
          delete this.#subscriptionKeys[subscriptionKey]
        }
      }
    })

    const subscription = {
      method: 'unsubscribe',
      params: {
        ...params,
        channel: this.#channel,
      },
    }

    this.sendSubscribe(subscription)
    return this
  }


  // Send subscribe WebSocket commands to resubscribe to all subscriptions
  sendSubscribeToResubscribe() {
    // Check if we have any subscriptions yet
    if (this.#subscriptionKeys === undefined) {
      return
    }

    const subscriptions = []
    Object.entries(this.#subscriptionKeys).forEach(([subscriptionKey, symbolsSet]) => {
      const params = JSON.parse(subscriptionKey)
      if (symbolsSet.size > 0) {
        params.symbol = Array.from(symbolsSet)
      }

      subscriptions.push({
        method: 'subscribe',
        params: {
          ...params,
          channel: this.#channel,
        },
      })
    })

    subscriptions.forEach((subscription) => {
      this.sendSubscribe(subscription)
    })
  }

  // Send subscribe WebSocket command
  sendSubscribe(subscription) {
    // Check if WebSocket connection is ready
    if (this.#webSocket.readyState === 1) {
      const subscriptionToSend = { ...subscription, req_id: uniqueId() }
      if (privateSubscriptionChannels.has(this.#channel)) {
        subscriptionToSend.params.token = this.#webSocket.info.token
      }

      this.#webSocket.send(subscriptionToSend)
    }
  }

  #onSubscribe = (data) => {
    if (data.channel === this.#channel) {
      this.emit('subscribe', data)
    }
  }

  #onUnsubscribe = (data) => {
    this.#webSocket.off('subscribe', this.#onSubscribe)
    this.#webSocket.off('unsubscribe', this.#onUnsubscribe)
    this.#webSocket.off('message', this.#onMessage)
    if (data.channel === this.#channel) {
      this.emit('unsubscribe', data)
    }
  }

  #onMessage = (message) => {
    const data = JSON.parse(message)
    if (data.channel === this.#channel) {
      this.emit(data.type, data)
    }
  }

  #validateSymbol(symbol) {
    if (!Array.isArray(symbol)) {
      throw new Error(`Invalid symbol "${symbol}"`)
    }
  }
}
