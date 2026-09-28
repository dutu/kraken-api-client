import { test } from 'node:test'
import assert from 'node:assert/strict'

import Kraken from '../src/index.mjs'
import { Socks5Proxy } from './helpers/socks5Proxy.mjs'
import { reserveClosedPort, startHttpTarget, startWebSocketTarget } from './helpers/servers.mjs'

const REST_CREDENTIALS = { apiKey: 'test-key', apiSecret: 'c2VjcmV0' }

function waitForOpen(webSocket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for the WebSocket to open'))
    }, timeoutMs)
    const onOpen = () => { cleanup(); resolve() }
    const onError = (error) => { cleanup(); reject(error) }
    const cleanup = () => {
      clearTimeout(timer)
      webSocket.off('open', onOpen)
      webSocket.off('error', onError)
    }
    webSocket.on('open', onOpen)
    webSocket.on('error', onError)
  })
}

function waitForError(webSocket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for the WebSocket error'))
    }, timeoutMs)
    const onError = (error) => { cleanup(); resolve(error) }
    const cleanup = () => {
      clearTimeout(timer)
      webSocket.off('error', onError)
    }
    webSocket.on('error', onError)
  })
}

test('REST requests tunnel through the SOCKS proxy, preserving headers and keep-alive', async () => {
  const proxy = await new Socks5Proxy().listen()
  const target = await startHttpTarget()
  const kraken = new Kraken(undefined, {
    socksProxyUri: proxy.uri(),
    baseUrls: { public: target.httpUrl, production: target.httpUrl },
  })

  try {
    await kraken.rest.getSystemStatus({})
    await kraken.rest.getSystemStatus({})

    assert.equal(target.state.requests.length, 2)
    // Axios injects an Accept header; seeing it at the target proves headers survive the tunnel.
    assert.ok(target.state.requests[0].headers.accept, 'Accept header should be preserved')
    // Keep-alive: two requests share a single TCP connection to the target.
    assert.equal(target.state.tcpConnections, 1)

    assert.deepEqual(proxy.connections, [
      { version: 5, command: 1, addressType: 1, host: '127.0.0.1', port: target.port },
    ])
  } finally {
    kraken.ws.close()
    await target.close()
    await proxy.close()
  }
})

test('authenticated REST requests keep auth headers through the proxy', async () => {
  const proxy = await new Socks5Proxy().listen()
  const target = await startHttpTarget()
  const kraken = new Kraken(REST_CREDENTIALS, {
    socksProxyUri: proxy.uri(),
    baseUrls: { production: target.httpUrl },
  })

  try {
    const response = await kraken.rest.getWebsocketsToken()
    assert.equal(response.result.token, 'test-token')
    assert.ok(target.state.requests[0].headers['api-key'], 'API-Key header should be preserved')
    assert.ok(target.state.requests[0].headers['api-sign'], 'API-Sign header should be preserved')
  } finally {
    kraken.ws.close()
    await target.close()
    await proxy.close()
  }
})

test('public WebSocket upgrade tunnels through the SOCKS proxy', async () => {
  const proxy = await new Socks5Proxy().listen()
  const wsTarget = await startWebSocketTarget()
  const kraken = new Kraken(undefined, {
    socksProxyUri: proxy.uri(),
    webSocketEndpoints: { public: wsTarget.wsUrl },
  })

  try {
    const opened = waitForOpen(kraken.ws)
    await kraken.ws.connect()
    await opened

    assert.equal(wsTarget.state.upgrades.length, 1)
    assert.deepEqual(proxy.connections, [
      { version: 5, command: 1, addressType: 1, host: '127.0.0.1', port: wsTarget.port },
    ])
  } finally {
    kraken.ws.close()
    await wsTarget.close()
    await proxy.close()
  }
})

test('private WebSocket token request and upgrade both tunnel through the SOCKS proxy', async () => {
  const proxy = await new Socks5Proxy().listen()
  const restTarget = await startHttpTarget()
  const wsTarget = await startWebSocketTarget()
  const kraken = new Kraken(REST_CREDENTIALS, {
    socksProxyUri: proxy.uri(),
    baseUrls: { production: restTarget.httpUrl },
    webSocketEndpoints: { private: wsTarget.wsUrl },
  })

  try {
    const opened = waitForOpen(kraken.ws)
    await kraken.ws.connect()
    await opened

    assert.equal(restTarget.state.requests.length, 1)
    assert.equal(wsTarget.state.upgrades.length, 1)
    assert.deepEqual(proxy.connections, [
      { version: 5, command: 1, addressType: 1, host: '127.0.0.1', port: restTarget.port },
      { version: 5, command: 1, addressType: 1, host: '127.0.0.1', port: wsTarget.port },
    ])
  } finally {
    kraken.ws.close()
    await restTarget.close()
    await wsTarget.close()
    await proxy.close()
  }
})

test('an unreachable proxy causes a failure without any direct fallback', async () => {
  const closedPort = await reserveClosedPort()
  const target = await startHttpTarget()
  const wsTarget = await startWebSocketTarget()
  const kraken = new Kraken(REST_CREDENTIALS, {
    socksProxyUri: `socks5://127.0.0.1:${closedPort}`,
    baseUrls: { public: target.httpUrl, production: target.httpUrl },
    webSocketEndpoints: { public: wsTarget.wsUrl, private: wsTarget.wsUrl },
  })

  try {
    await assert.rejects(() => kraken.rest.getSystemStatus({}))

    const errored = waitForError(kraken.ws)
    await kraken.ws.connect()
    await errored

    // Nothing reached the upstream servers, proving there was no direct fallback.
    assert.equal(target.state.tcpConnections, 0)
    assert.equal(target.state.requests.length, 0)
    assert.equal(wsTarget.state.upgrades.length, 0)
  } finally {
    kraken.ws.close()
    await target.close()
    await wsTarget.close()
  }
})

test('proxy credentials are supplied for authenticated SOCKS proxies', async () => {
  const proxy = await new Socks5Proxy({ auth: { username: 'proxy-user', password: 'proxy-pass' } }).listen()
  const target = await startHttpTarget()
  const kraken = new Kraken(undefined, {
    socksProxyUri: proxy.uri(),
    baseUrls: { public: target.httpUrl },
  })

  try {
    await kraken.rest.getSystemStatus({})
    assert.deepEqual(proxy.authentications, [{ username: 'proxy-user', ok: true }])
  } finally {
    kraken.ws.close()
    await target.close()
    await proxy.close()
  }
})

test('a proxy password containing @ is used in full and stays fully masked', async () => {
  const proxy = await new Socks5Proxy({ auth: { username: 'proxy-user', password: 'pa@ss' } }).listen()
  const target = await startHttpTarget()
  const kraken = new Kraken(undefined, {
    socksProxyUri: proxy.uri(),
    baseUrls: { public: target.httpUrl },
  })

  try {
    await kraken.rest.getSystemStatus({})
    // The agent uses the whole password (pa@ss), not just the part before the last @.
    assert.deepEqual(proxy.authentications, [{ username: 'proxy-user', ok: true }])
  } finally {
    kraken.ws.close()
    await target.close()
    await proxy.close()
  }
})

test('socks5h delegates DNS to the proxy while socks5 resolves locally', async () => {
  const proxy = await new Socks5Proxy().listen()
  const unresolvableUrl = 'http://does-not-exist.invalid:8080'

  const remoteDns = new Kraken(undefined, {
    socksProxyUri: proxy.uri('socks5h'),
    baseUrls: { public: unresolvableUrl },
  })
  const localDns = new Kraken(undefined, {
    socksProxyUri: proxy.uri('socks5'),
    baseUrls: { public: unresolvableUrl },
  })

  try {
    await assert.rejects(() => remoteDns.rest.getSystemStatus({}))
    await assert.rejects(() => localDns.rest.getSystemStatus({}))

    // socks5h forwards the hostname to the proxy (domain, ATYP 3); socks5 resolves
    // locally first, so a nonexistent name never reaches the proxy.
    assert.deepEqual(proxy.connections, [
      { version: 5, command: 1, addressType: 3, host: 'does-not-exist.invalid', port: 8080 },
    ])
  } finally {
    remoteDns.ws.close()
    localDns.ws.close()
    await proxy.close()
  }
})

test('proxy credentials are masked in request errors', async () => {
  const closedPort = await reserveClosedPort()
  const target = await startHttpTarget()
  const kraken = new Kraken(undefined, {
    socksProxyUri: `socks5://user:pa@ss@127.0.0.1:${closedPort}`,
    baseUrls: { public: target.httpUrl },
  })

  try {
    await assert.rejects(
      () => kraken.rest.getSystemStatus({}),
      (error) => {
        assert.ok(!error.message.includes('pa@ss'), 'credentials must be masked in errors')
        assert.ok(!error.message.includes('ss@127.0.0.1'), 'the password fragment must not leak in errors')
        return true
      },
    )
  } finally {
    kraken.ws.close()
    await target.close()
  }
})

test('the default public base URL is used when only the proxy is configured', async () => {
  // failConnects keeps the test hermetic: the proxy records the CONNECT target without dialing it.
  const proxy = await new Socks5Proxy({ failConnects: true }).listen()
  const kraken = new Kraken(undefined, { socksProxyUri: proxy.uri('socks5h') })

  try {
    // Before the fix this rejected with "Invalid URL" and never reached the proxy.
    await assert.rejects(() => kraken.rest.getSystemStatus({}))
    assert.deepEqual(proxy.connections, [
      { version: 5, command: 1, addressType: 3, host: 'api.kraken.com', port: 443 },
    ])
  } finally {
    kraken.ws.close()
    await proxy.close()
  }
})

test('getServerTime and getOrderBook use the public endpoint paths', async () => {
  const target = await startHttpTarget()
  const kraken = new Kraken(undefined, { baseUrls: { public: target.httpUrl } })

  try {
    await kraken.rest.getServerTime({})
    await kraken.rest.getOrderBook({ pair: 'XBTUSD' })

    assert.deepEqual(
      target.state.requests.map((request) => request.url),
      ['/0/public/Time', '/0/public/Depth?pair=XBTUSD'],
    )
  } finally {
    kraken.ws.close()
    await target.close()
  }
})
