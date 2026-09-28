import http from 'node:http'
import crypto from 'node:crypto'

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/**
 * Starts a loopback HTTP server that records every request (method, url, headers, body)
 * and replies with JSON. Useful for asserting that headers are preserved through a proxy.
 */
export async function startHttpTarget() {
  const state = { requests: [], tcpConnections: 0 }
  const sockets = new Set()

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      state.requests.push({ method: req.method, url: req.url, headers: req.headers, body })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ result: { ok: true, path: req.url, token: 'test-token' } }))
    })
  })
  server.on('connection', (socket) => {
    state.tcpConnections++
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  return {
    port,
    state,
    httpUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}/v2`,
    close: () => new Promise((resolve) => {
      sockets.forEach((socket) => socket.destroy())
      sockets.clear()
      server.close(() => resolve())
    }),
  }
}

/**
 * Starts a loopback WebSocket server that upgrades every request (records the url and headers)
 * and keeps the socket open. Only the handshake is implemented, which is enough to observe the
 * upgraded connection path.
 */
export async function startWebSocketTarget() {
  const state = { upgrades: [] }
  const sockets = new Set()

  const server = http.createServer()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.on('upgrade', (req, socket) => {
    state.upgrades.push({ url: req.url, headers: req.headers })
    const accept = crypto
      .createHash('sha1')
      .update(req.headers['sec-websocket-key'] + WEBSOCKET_GUID)
      .digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    )
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  return {
    port,
    state,
    wsUrl: `ws://127.0.0.1:${port}/v2`,
    close: () => new Promise((resolve) => {
      sockets.forEach((socket) => socket.destroy())
      sockets.clear()
      server.close(() => resolve())
    }),
  }
}

/**
 * Reserves a loopback port and immediately releases it, yielding a port that is very
 * likely closed. Used to simulate an unreachable proxy.
 */
export async function reserveClosedPort() {
  const server = http.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}
