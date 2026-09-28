import { SocksProxyAgent } from 'socks-proxy-agent'

/**
 * The SOCKS URL protocols accepted for `serviceConfig.socksProxyUri`.
 * `socks:` and `socks5h:` let the proxy resolve the destination hostname,
 * while `socks4:`, `socks4a:` and `socks5:` resolve it locally first.
 */
export const SUPPORTED_SOCKS_PROTOCOLS = ['socks:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:']

// Matches the authority userinfo up to the last `@` of the authority, because a
// password may itself contain `@` (e.g. `socks5://user:pa@ss@host:1080`). The
// greedy match stops at `/`, `?`, `#` or whitespace so hosts and paths are untouched.
const CREDENTIALS_PATTERN = /(\/\/)([^/?#\s]+)@/g

// A well-formed proxy URI is a scheme followed by `//` and an authority.
const WELL_FORMED_PROXY_URI = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

/**
 * Masks the username and password (if any) of a proxy URI so it can be safely
 * included in error messages and logs.
 *
 * Well-formed values (`scheme://authority`) keep their scheme, host and path, and only
 * the authority userinfo is replaced. Malformed values that lack the `scheme://` shape
 * cannot be parsed reliably, so everything before the last `@` is replaced with `***:***`
 * (keeping the `@host…` tail) to guarantee no credential fragment is exposed.
 *
 * @param {unknown} uri - The proxy URI, possibly containing credentials.
 * @returns {string} - The URI with credentials replaced by `***:***`, or the input coerced to a string.
 *
 * @example
 * maskProxyUri('socks5://user:secret@127.0.0.1:1080')
 * // => 'socks5://***:***@127.0.0.1:1080'
 * maskProxyUri('socks5:/user:secret@127.0.0.1:1080')
 * // => '***:***@127.0.0.1:1080'
 */
export function maskProxyUri(uri) {
  if (typeof uri !== 'string') {
    return String(uri)
  }

  if (WELL_FORMED_PROXY_URI.test(uri)) {
    return uri.replace(CREDENTIALS_PATTERN, '$1***:***@')
  }

  const atSign = uri.lastIndexOf('@')
  return atSign === -1 ? uri : `***:***${uri.slice(atSign)}`
}

/**
 * Extracts the userinfo (username and password) of a URI, i.e. everything between
 * `//` and the last `@` of the authority. Returns `undefined` when the URI has no
 * authority, no `@`, or an empty userinfo.
 *
 * @param {unknown} uri - The URI to inspect.
 * @returns {string|undefined} - The raw userinfo, or `undefined`.
 */
function userinfoOf(uri) {
  if (typeof uri !== 'string') return undefined

  const schemeSeparator = uri.indexOf('//')
  if (schemeSeparator === -1) return undefined

  const authorityStart = schemeSeparator + 2
  let authorityEnd = uri.length
  for (const terminator of ['/', '?', '#']) {
    const index = uri.indexOf(terminator, authorityStart)
    if (index !== -1 && index < authorityEnd) {
      authorityEnd = index
    }
  }

  const atSign = uri.lastIndexOf('@', authorityEnd - 1)
  if (atSign <= authorityStart) return undefined

  return uri.slice(authorityStart, atSign)
}

/**
 * Removes proxy credentials from an arbitrary message (e.g. an error message) by
 * masking every credential-looking fragment and any explicit occurrence of the
 * provided proxy URI.
 *
 * @param {unknown} message - The message to sanitize.
 * @param {string} [proxyUri] - The configured proxy URI whose exact form must be masked.
 * @returns {string} - The sanitized message.
 */
export function maskProxySecrets(message, proxyUri) {
  let sanitized = typeof message === 'string' ? message : String(message)
  sanitized = sanitized.replace(CREDENTIALS_PATTERN, '$1***:***@')

  if (typeof proxyUri === 'string' && proxyUri.length > 0) {
    const masked = maskProxyUri(proxyUri)
    sanitized = sanitized.split(proxyUri).join(masked)
    const userinfo = userinfoOf(proxyUri)
    if (userinfo) {
      sanitized = sanitized.split(userinfo).join('***:***')
    }
  }

  return sanitized
}

/**
 * Validates a SOCKS proxy URI and returns its parsed components.
 * A scheme in {@link SUPPORTED_SOCKS_PROTOCOLS}, a host and an explicit port are required.
 *
 * @param {unknown} uri - The proxy URI to validate.
 * @returns {{protocol: string, host: string, port: number}} - The parsed components.
 * @throws {Error} If the URI is not a string, cannot be parsed, uses an unsupported scheme,
 *   or is missing a host or an explicit port. The thrown message never contains credentials.
 *
 * @example
 * parseSocksProxyUri('socks5://user:secret@127.0.0.1:1080')
 * // => { protocol: 'socks5:', host: '127.0.0.1', port: 1080 }
 */
export function parseSocksProxyUri(uri) {
  const fail = (reason) => {
    throw new Error(`Invalid serviceConfig.socksProxyUri ${JSON.stringify(maskProxyUri(uri))}: ${reason}`)
  }

  if (typeof uri !== 'string' || uri.trim() === '') {
    fail('a non-empty string is required.')
  }

  let parsed
  try {
    parsed = new URL(uri)
  } catch {
    fail(`it is not a valid URL. Expected one of ${SUPPORTED_SOCKS_PROTOCOLS.join(', ')}.`)
  }

  if (!SUPPORTED_SOCKS_PROTOCOLS.includes(parsed.protocol)) {
    fail(`unsupported scheme "${parsed.protocol}". Expected one of ${SUPPORTED_SOCKS_PROTOCOLS.join(', ')}.`)
  }

  if (!parsed.hostname) {
    fail('a host is required.')
  }

  if (!parsed.port) {
    fail('an explicit port is required (e.g. socks5://host:1080).')
  }

  const port = Number.parseInt(parsed.port, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail('the port must be an integer between 1 and 65535.')
  }

  return { protocol: parsed.protocol, host: parsed.hostname, port }
}

/**
 * Creates a SOCKS proxy agent used to tunnel HTTP requests and WebSocket upgrades.
 * The URI is validated first, so invalid settings fail fast at client construction.
 *
 * @param {string} uri - The validated proxy URI.
 * @param {Object} [options={}] - Agent options.
 * @param {boolean} [options.keepAlive=true] - Whether connections to the proxy are kept alive.
 * @returns {import('socks-proxy-agent').SocksProxyAgent} - The proxy agent.
 * @throws {Error} If the URI is invalid (see {@link parseSocksProxyUri}).
 */
export function createSocksAgent(uri, { keepAlive = true } = {}) {
  parseSocksProxyUri(uri)
  try {
    return new SocksProxyAgent(uri, { keepAlive })
  } catch (error) {
    throw new Error(`Invalid serviceConfig.socksProxyUri ${JSON.stringify(maskProxyUri(uri))}: ${maskProxySecrets(error.message, uri)}`)
  }
}
