import WebSocket from 'isomorphic-ws'
import { ForeverWebSocket } from 'forever-websocket'
import { createMessageSequenceValidator } from './messageSequenceValidator.mjs'
import { ChannelManager, channels, privateSubscriptionChannels, publicSubscriptionChannels } from './channelManager.mjs'
import { RestWrapper } from '../rest/restWrapper.mjs'

const webSocketEndpoints = {
  public: 'wss://ws.kraken.com/v2',
  private: 'wss://ws-auth.kraken.com/v2',
}

export function createWebSocketClient(authentication, serviceConfig, market) {
  const log = serviceConfig.logger
  const isWebSocketPrivate = authentication !== undefined
  const isConnectionInitialized = false
  let webSocket
  let wsInfo = undefined
  let wsEndpoint
  let isAvailable = false
  const messageSequenceValidator = createMessageSequenceValidator()
  let rest

  if (isWebSocketPrivate) {
    rest = new RestWrapper(authentication, serviceConfig)
  }

  const createWebSocket = async () => {
    let wsUrl
    if (isWebSocketPrivate) {
      // Websocket is private
      wsEndpoint = webSocketEndpoints.private
      const connectInfo = await rest.getWebsocketsToken()
      const instanceServer = connectInfo.data.instanceServers[0]
      return new WebSocket(wsUrl)
    } else {
      // Websocket is public
      wsEndpoint = webSocketEndpoints.public
      wsUrl = wsEndpoint
    }

    return new WebSocket(wsUrl)
  }

  const resentSubscribe = () => {
    for (const channel of [...publicSubscriptionChannels, ...privateSubscriptionChannels]) {
      webSocket[channel].sendSubscribeToResubscribe()
    }
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

  webSocket.book = new ChannelManager({ channel: 'book', webSocket })
  webSocket.executions = new ChannelManager({ channel: 'executions', webSocket })
  webSocket.instrument = new ChannelManager({ channel: 'instrument', webSocket })
  webSocket.ohlc = new ChannelManager({ channel: 'ohlc', webSocket })
  webSocket.ticker = new ChannelManager({ channel: 'ticker', webSocket })
  webSocket.trade = new ChannelManager({ channel: 'trade', webSocket })

  webSocket.on('open', ()=> {
    log.debug(`WebSocket connected to ${wsEndpoint}`)
    messageSequenceValidator.reset()
    resentSubscribe()
  })

  webSocket.on('message', (message)=> {
    const data = JSON.parse(message)

    if (['status', 'heartbeat'].includes(data.channel) || ['pong', 'subscribe', 'unsubscribe'].includes(data.method)) {
      if (data.channel === 'status') {
        wsInfo = data.data[0]
      }

      const event = data.channel || data.method
      webSocket.emit(event, data)
      log.debug(`WebSocket[${wsInfo.connection_id}] ${event}:\n${JSON.stringify(data, null, 2)}`)
    }
  })

  webSocket.on('error', (error)=> {
    log.notice(`WebSocket[${wsInfo.connectId}] ${error.message}`)
  })

  webSocket.on('timeout', ()=> {
    log.notice(`WebSocket[${wsInfo.connectId}] timed out after ${wsInfo.timeout / 1000} seconds`)
  })

  webSocket.on('delay', (retryNumber, delay)=> {
    log.info(`WebSocket[${wsInfo.connectId}] will try reconnecting in ${delay / 1000} seconds`)
  })

  webSocket.on('connecting', (retryNumber, delay)=> {
    log.info(`WebSocket[${wsInfo.connectId}] connecting... (${retryNumber})`)
  })

  webSocket.on('reconnected', (retryNumber, lastConnectedMts)=> {
    log.info(`WebSocket[${wsInfo.connectId}] reconnected after ${(Date.now() - lastConnectedMts) / 1000} seconds (${retryNumber})`)
  })

  webSocket.on('closed', ()=> {
    log.notice(`WebSocket[${wsInfo.connectId}] closed`)
    wsInfo = {}
  })

  return webSocket
}
