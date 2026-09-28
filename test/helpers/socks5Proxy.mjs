import net from 'node:net'

const SOCKS_VERSION = 0x05
const AUTH_VERSION = 0x01
const METHOD_NO_AUTH = 0x00
const METHOD_USER_PASSWORD = 0x02
const METHOD_NONE_ACCEPTABLE = 0xff
const CMD_CONNECT = 0x01

/**
 * A minimal, hermetic SOCKS5 server used to assert that the client tunnels its
 * traffic through the configured proxy. It supports the no-auth and
 * username/password methods and the CONNECT command (IPv4, IPv6 and domain).
 *
 * Every accepted connection is recorded in `connections` as
 * `{ version, command, addressType, host, port }`, and authentication attempts in
 * `authentications` as `{ username, ok }`.
 */
export class Socks5Proxy {
  #server
  #sockets = new Set()

  /** @type {{version: number, command: number, addressType: number, host: string, port: number}[]} */
  connections = []
  /** @type {{username: string, ok: boolean}[]} */
  authentications = []

  /**
   * @param {Object} [options={}]
   * @param {{username: string, password: string}} [options.auth] - Require username/password auth.
   * @param {boolean} [options.failConnects=false] - Reply "connection refused" to every CONNECT.
   */
  constructor({ auth, failConnects = false } = {}) {
    this.auth = auth
    this.failConnects = failConnects
    this.#server = net.createServer((socket) => this.#handle(socket))
  }

  /**
   * Starts listening on an ephemeral loopback port.
   *
   * @returns {Promise<Socks5Proxy>} - This instance.
   */
  async listen() {
    await new Promise((resolve) => this.#server.listen(0, '127.0.0.1', resolve))
    this.port = this.#server.address().port
    return this
  }

  /**
   * The proxy URI for the running server, including credentials when auth is required.
   *
   * @param {string} [scheme='socks5'] - The SOCKS scheme to advertise (e.g. `socks5h`).
   * @returns {string}
   */
  uri(scheme = 'socks5') {
    const credentials = this.auth ? `${this.auth.username}:${this.auth.password}@` : ''
    return `${scheme}://${credentials}127.0.0.1:${this.port}`
  }

  async close() {
    for (const socket of this.#sockets) {
      socket.destroy()
    }
    this.#sockets.clear()
    await new Promise((resolve) => this.#server.close(resolve))
  }

  #handle(socket) {
    this.#sockets.add(socket)
    socket.on('error', () => {})
    socket.on('close', () => this.#sockets.delete(socket))

    let buffer = Buffer.alloc(0)
    let stage = 'greeting'
    let pendingUpstreams = []

    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      let progressed = true
      while (progressed) {
        progressed = false
        if (stage === 'greeting') {
          if (buffer.length < 2) break
          const methodCount = buffer[1]
          if (buffer.length < 2 + methodCount) break
          const methods = [...buffer.subarray(2, 2 + methodCount)]
          buffer = buffer.subarray(2 + methodCount)
          const method = this.#selectMethod(methods)
          socket.write(Buffer.from([SOCKS_VERSION, method]))
          if (method === METHOD_NONE_ACCEPTABLE) {
            stage = 'done'
            socket.end()
          } else {
            stage = method === METHOD_USER_PASSWORD ? 'auth' : 'request'
          }
          progressed = true
        } else if (stage === 'auth') {
          if (buffer.length < 2) break
          const usernameLength = buffer[1]
          if (buffer.length < 3 + usernameLength) break
          const passwordLength = buffer[2 + usernameLength]
          if (buffer.length < 3 + usernameLength + passwordLength) break
          const username = buffer.subarray(2, 2 + usernameLength).toString()
          const password = buffer.subarray(3 + usernameLength, 3 + usernameLength + passwordLength).toString()
          buffer = buffer.subarray(3 + usernameLength + passwordLength)
          const ok = username === this.auth?.username && password === this.auth?.password
          this.authentications.push({ username, ok })
          socket.write(Buffer.from([AUTH_VERSION, ok ? 0x00 : 0x01]))
          stage = ok ? 'request' : 'done'
          if (!ok) {
            socket.end()
          }
          progressed = true
        } else if (stage === 'request') {
          const parsed = this.#parseRequest(buffer)
          if (!parsed) break
          buffer = buffer.subarray(parsed.consumed)
          this.connections.push(parsed.connection)

          if (parsed.connection.command !== CMD_CONNECT || this.failConnects) {
            socket.end(Buffer.from([SOCKS_VERSION, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
            stage = 'done'
            progressed = true
            continue
          }

          const upstream = net.connect(parsed.connection.port, parsed.connection.host, () => {
            socket.write(Buffer.from([SOCKS_VERSION, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
            upstream.pipe(socket)
            socket.pipe(upstream)
          })
          upstream.on('error', () => {
            socket.end(Buffer.from([SOCKS_VERSION, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
          })
          pendingUpstreams.push(upstream)
          socket.on('close', () => upstream.destroy())
          stage = 'relay'
          progressed = true
        } else {
          break
        }
      }
    }

    socket.on('data', onData)
    socket.on('close', () => {
      pendingUpstreams.forEach((upstream) => upstream.destroy())
      pendingUpstreams = []
    })
  }

  #selectMethod(methods) {
    if (!this.auth) {
      return methods.includes(METHOD_NO_AUTH) ? METHOD_NO_AUTH : METHOD_NONE_ACCEPTABLE
    }
    return methods.includes(METHOD_USER_PASSWORD) ? METHOD_USER_PASSWORD : METHOD_NONE_ACCEPTABLE
  }

  #parseRequest(buffer) {
    if (buffer.length < 4) return null
    const command = buffer[1]
    const addressType = buffer[3]

    let host
    let portOffset
    if (addressType === 0x01) {
      if (buffer.length < 10) return null
      host = Array.from(buffer.subarray(4, 8)).join('.')
      portOffset = 8
    } else if (addressType === 0x03) {
      if (buffer.length < 5) return null
      const length = buffer[4]
      if (buffer.length < 5 + length + 2) return null
      host = buffer.subarray(5, 5 + length).toString()
      portOffset = 5 + length
    } else if (addressType === 0x04) {
      if (buffer.length < 22) return null
      host = Array.from(buffer.subarray(4, 20)).map((byte) => byte.toString(16).padStart(2, '0')).join(':')
      portOffset = 20
    } else {
      return { consumed: buffer.length, connection: { version: buffer[0], command, addressType, host: '', port: 0 } }
    }

    return {
      consumed: portOffset + 2,
      connection: {
        version: buffer[0],
        command,
        addressType,
        host,
        port: buffer.readUInt16BE(portOffset),
      },
    }
  }
}
