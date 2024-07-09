import WebSocket from 'isomorphic-ws'
import EventEmitter from 'eventemitter3'
import { ForeverWebSocket } from 'forever-websocket'
import { RestWrapper } from '../rest/restWrapper.mjs'
import { uniqueId } from '../utils/uniqueId.mjs'

const webSocketEndpoints = {
  public: 'wss://ws.kraken.com/v2',
  private: 'wss://ws-auth.kraken.com/v2',
}

const channels = {
  executions: 'executions',
  balances: 'balances',
  ticker: 'ticker',
  book: 'book',
  level3: 'level3',
  ohlc: 'ohlc',
  trade: 'trade',
  instrument: 'instrument',
  status: 'status',
  heartbeat: 'heartbeat',
  ping: 'ping',
}

const privateSubscriptionChannels = new Set([channels.executions, channels.balances, channels.level3])
const publicSubscriptionChannels = new Set([channels.ticker, channels.book, channels.ohlc, channels.trade, channels.instrument])

export function createWebSocketClient(authentication, serviceConfig) {
  const log = serviceConfig.logger
  const isWebSocketPrivate = authentication !== undefined
  let webSocket
  let wsInfo
  let isAvailable = false
  let rest
  const subscriptionKeys = {}
  const requestsCallbacks = new Map()

  const validateSymbol = (symbol) => {
    if (!Array.isArray(symbol)) {
      throw new Error(`Invalid symbol "${symbol}"`)
    }
  }

  const createWebSocket = async () => {
    if (isWebSocketPrivate) {
      // Websocket is private
      const { result: tokenInfo } = await rest.getWebsocketsToken()
      wsInfo = {
        endPoint: webSocketEndpoints.private,
        token: tokenInfo.token,
      }
    } else {
      wsInfo = {
        endPoint: webSocketEndpoints.public
      }
    }

    return new WebSocket(wsInfo.endPoint)
  }

  const registerSubscription = (subscription) => {
    const { token,  symbol: symbolArray = [], ...subscriptionObject} = subscription.params
    validateSymbol(symbolArray)
    const subscriptionKey = JSON.stringify(subscriptionObject)

    subscriptionKeys[subscriptionKey] ??= new Set()
    symbolArray.forEach(symbol => {
      subscriptionKeys[subscriptionKey].add(symbol)
    })
  }

  const sendSubscription = (subscription) => {
    // Check if WebSocket connection is ready
    if (webSocket?.readyState === 1) {
      const subscriptionToSend = { ...subscription, req_id: uniqueId() }
      if (privateSubscriptionChannels.has(subscription.params.channel)) {
        subscriptionToSend.params.token = webSocket.info.token
      }

      webSocket.send(subscriptionToSend)
    }
  }

  const sendAllSubscriptions = () => {
    const subscriptions = []
    Object.entries(subscriptionKeys).forEach(([subscriptionKey, symbolsSet]) => {
      const params = JSON.parse(subscriptionKey)
      if (symbolsSet.size > 0) {
        params.symbol = Array.from(symbolsSet)
      }

      const subscription = {
        method: 'subscribe',
        params: {
          ...params,
        },
      }

      sendSubscription(subscription)
    })
  }

  const subscribe = (channel, params) => {
    const subscription = {
      method: 'subscribe',
      params: {
        ...params,
        channel,
      },
    }

    registerSubscription(subscription)
    sendSubscription(subscription)
    return webSocket[channel]
  }

  const request = (method, params) => {
    const requestToSend = {
      method,
      params: {
        ...params,
        token: webSocket.info.token
      },
      req_id: uniqueId(),
    }

    return new Promise((resolve, reject) => {
      requestsCallbacks.set(requestToSend.req_id, { resolve, reject})
      try {
        webSocket.send(requestToSend)
      } catch (e) {
        requestsCallbacks.delete(requestToSend.req_id)
        reject(e)
      }
    })
  }

  if (isWebSocketPrivate) {
    rest = new RestWrapper(authentication, serviceConfig)
  }

  webSocket = new ForeverWebSocket(
    undefined,
    undefined,
    {
      automaticOpen: false,
      reconnect: {},
      timeout: 62000,
      ping: {
        interval: 30000,
        data: {
          "method": "ping"
        }
      },
      createWebSocket,
    }
  )

  Object.defineProperty(webSocket, 'info', {
    get() { return wsInfo },
    set(value) { log.warn('info property is read-only') }
  })

  Object.defineProperty(webSocket, 'isAvailable', {
    get() { return isAvailable },
    set(value) { log.warn('isAvailable property is read-only') }
  })

  // Define User Data channels
  webSocket.executions = new EventEmitter()
  webSocket.executions.subscribe = subscribe.bind(this, channels.executions)
  webSocket.balances = new EventEmitter()
  webSocket.balances.subscribe = subscribe.bind(this, channels.balances)

  // Define Market Data channels
  webSocket.ticker = new EventEmitter()
  webSocket.ticker.subscribe = subscribe.bind(this, channels.ticker)
  webSocket.book = new EventEmitter()
  webSocket.book.subscribe = subscribe.bind(this, channels.book)
  webSocket.ohlc = new EventEmitter()
  webSocket.ohlc.subscribe = subscribe.bind(this, channels.ohlc)
  webSocket.trade = new EventEmitter()
  webSocket.trade.subscribe = subscribe.bind(this, channels.trade)
  webSocket.instrument = new EventEmitter()
  webSocket.instrument.subscribe = subscribe.bind(this, channels.instrument)

  // Define Admin channels
  webSocket.status = new EventEmitter()
  webSocket.heartbeat = new EventEmitter()

  webSocket.addOrder = ({ params }) => request('add_order', params)

  webSocket.on('open', ()=> {
    wsInfo.id = uniqueId()
    log.debug(`WebSocket[${wsInfo.id}] connected to ${wsInfo.endpoint}`)
    sendAllSubscriptions()
  })

  webSocket.on('message', (message)=> {
    const data = JSON.parse(message)
    const channel = data.channel || data.result?.channel

    if (channel) {
      const type = data.method === 'subscribe' && 'subscribed'
        || data.channel === 'heartbeat' && 'heartbeat'
        || data.type

      webSocket[channel].emit(type, data)
      return
    }

    if (data.req_id) {
      const resolve = requestsCallbacks.get(data.req_id)?.resolve
      if (resolve) {
        requestsCallbacks.delete(data.req_id)
        resolve(data)
      }
    }
  })

  webSocket.on('error', (error)=> {
    log.notice(`WebSocket[${wsInfo?.id || ''}] ${error.message}`)
  })

  webSocket.on('timeout', ()=> {
    log.notice(`WebSocket[${wsInfo?.id || ''}] timed out`)
  })

  webSocket.on('delay', (retryNumber, delay)=> {
    log.info(`WebSocket[${wsInfo?.id || ''}] will try reconnecting in ${delay / 1000} seconds`)
  })

  webSocket.on('connecting', (retryNumber, delay)=> {
    log.info(`WebSocket[${wsInfo?.id || ''}] connecting... (${retryNumber})`)
  })

  webSocket.on('reconnected', (retryNumber, lastConnectedMts)=> {
    log.info(`WebSocket[${wsInfo?.id || ''}] reconnected after ${(Date.now() - lastConnectedMts) / 1000} seconds (${retryNumber})`)
  })

  webSocket.on('close', ()=> {
    log.notice(`WebSocket[${wsInfo?.id || ''}] closed`)
  })

  return webSocket
}
