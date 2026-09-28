import { test } from 'node:test'
import assert from 'node:assert/strict'

import Kraken from '../src/index.mjs'
import {
  createSocksAgent,
  maskProxySecrets,
  maskProxyUri,
  parseSocksProxyUri,
  SUPPORTED_SOCKS_PROTOCOLS,
} from '../src/proxy/socksProxy.mjs'

test('parseSocksProxyUri accepts every supported scheme and parses host/port/credentials', () => {
  for (const protocol of SUPPORTED_SOCKS_PROTOCOLS) {
    const scheme = protocol.replace(':', '')
    const parsed = parseSocksProxyUri(`${scheme}://user:secret@proxy.example.com:1080`)
    assert.deepEqual(parsed, { protocol, host: 'proxy.example.com', port: 1080 })
  }

  assert.deepEqual(
    parseSocksProxyUri('socks5://127.0.0.1:1080'),
    { protocol: 'socks5:', host: '127.0.0.1', port: 1080 },
  )
})

test('parseSocksProxyUri rejects invalid proxy settings', () => {
  const invalid = [
    undefined,
    null,
    '',
    '   ',
    1080,
    'not a uri',
    'http://proxy.example.com:8080',
    'https://proxy.example.com:8080',
    'socks5://',
    'socks5://proxy.example.com',
    'socks5://proxy.example.com:0',
    'socks5://proxy.example.com:70000',
  ]

  for (const value of invalid) {
    assert.throws(() => parseSocksProxyUri(value), /Invalid serviceConfig\.socksProxyUri/)
  }
})

test('maskProxyUri replaces both username and password', () => {
  assert.equal(maskProxyUri('socks5://user:secret@127.0.0.1:1080'), 'socks5://***:***@127.0.0.1:1080')
  assert.equal(maskProxyUri('socks5://127.0.0.1:1080'), 'socks5://127.0.0.1:1080')
  // A path may contain `@` without it being part of the userinfo.
  assert.equal(
    maskProxyUri('socks5://user:secret@host:1080/proxy@path'),
    'socks5://***:***@host:1080/proxy@path',
  )
})

test('maskProxyUri redacts the whole userinfo when the password contains @', () => {
  const masked = maskProxyUri('socks5://user:pa@ss@127.0.0.1:1080')
  assert.equal(masked, 'socks5://***:***@127.0.0.1:1080')
  assert.ok(!masked.includes('pa@ss'), 'the password must not leak')
  assert.ok(!masked.includes('ss@'), 'the trailing password fragment must not leak')

  assert.equal(
    maskProxyUri('socks5://user:p@a@ss@proxy.example.com:1080'),
    'socks5://***:***@proxy.example.com:1080',
  )
  assert.equal(
    maskProxyUri('socks5://user:pa%40ss@proxy.example.com:1080'),
    'socks5://***:***@proxy.example.com:1080',
  )
})

test('maskProxySecrets redacts the whole userinfo of every proxy URI in a message', () => {
  const uri = 'socks5://user:pa@ss@127.0.0.1:1080'

  const fromUri = maskProxySecrets(`connect ECONNREFUSED ${uri}`, uri)
  assert.match(fromUri, /\*\*\*:\*\*\*@127\.0\.0\.1:1080/)
  assert.ok(!fromUri.includes('pa@ss'))
  assert.ok(!fromUri.includes('ss@127.0.0.1'), 'the trailing password fragment must not leak')

  // A message that contains only the raw userinfo (no scheme) must be masked too.
  const fromUserinfo = maskProxySecrets('proxy authentication failed for user:pa@ss@127.0.0.1', uri)
  assert.ok(!fromUserinfo.includes('pa@ss'))
  assert.ok(!fromUserinfo.includes('ss@127.0.0.1'), 'the trailing password fragment must not leak')

  // Every credential fragment in a message must be masked, not just the first.
  const twoUris = maskProxySecrets(
    'tried socks5://u1:pa@ss@127.0.0.1:1080 then socks5://u2:other@127.0.0.1:1081',
    uri,
  )
  assert.ok(!twoUris.includes('pa@ss'))
  assert.ok(!twoUris.includes('other'))
})

test('maskProxyUri safely redacts malformed values without scheme://authority', () => {
  const malformed = [
    'socks5:/user:secret@host:1080',
    'socks5:user:secret@host:1080',
    'user:secret@host:1080',
    'user:pa@ss@host:1080',
  ]

  for (const value of malformed) {
    const masked = maskProxyUri(value)
    assert.equal(masked, '***:***@host:1080', `unexpected mask for ${value}`)
    assert.ok(!masked.includes('secret'), 'the password must not leak')
    assert.ok(!masked.includes('user:'), 'the userinfo must not leak')
  }

  // No credentials to redact.
  assert.equal(maskProxyUri('socks5:/host:1080'), 'socks5:/host:1080')
  assert.equal(maskProxyUri('not a uri'), 'not a uri')
})

test('maskProxySecrets masks a malformed proxy value embedded in a message', () => {
  const uri = 'socks5:/user:secret@host:1080'
  const masked = maskProxySecrets(`failed to connect via ${uri}`, uri)

  assert.ok(!masked.includes('secret'), 'the password must not leak')
  assert.ok(!masked.includes('user:'), 'the userinfo must not leak')
  assert.match(masked, /\*\*\*:\*\*\*@host:1080/)
})

test('invalid proxy settings fail at construction and never leak credentials', () => {
  const uri = 'socks5://user:supersecret@proxy.example.com'
  assert.throws(
    () => new Kraken(undefined, { socksProxyUri: uri }),
    (error) => {
      assert.match(error.message, /Invalid serviceConfig\.socksProxyUri/)
      assert.match(error.message, /explicit port is required/)
      assert.ok(!error.message.includes('supersecret'), 'credentials must be masked')
      assert.match(error.message, /\*\*\*:\*\*\*/)
      return true
    },
  )

  assert.throws(
    () => new Kraken(undefined, { socksProxyUri: 'socks5://user:supersecret@proxy.example.com:0' }),
    (error) => !error.message.includes('supersecret'),
  )
})

test('invalid proxy settings with @ in the password never leak a fragment', () => {
  assert.throws(
    () => new Kraken(undefined, { socksProxyUri: 'socks5://user:pa@ss@proxy.example.com' }),
    (error) => {
      assert.match(error.message, /Invalid serviceConfig\.socksProxyUri/)
      assert.match(error.message, /explicit port is required/)
      assert.match(error.message, /\*\*\*:\*\*\*@proxy\.example\.com/)
      assert.ok(!error.message.includes('pa@ss'), 'the password must not leak')
      assert.ok(!error.message.includes('ss@'), 'the trailing password fragment must not leak')
      return true
    },
  )
})

test('malformed proxy settings never leak credentials at construction', () => {
  for (const uri of ['socks5:/user:secret@host:1080', 'socks5:user:secret@host:1080', 'user:secret@host:1080']) {
    assert.throws(
      () => new Kraken(undefined, { socksProxyUri: uri }),
      (error) => {
        assert.match(error.message, /Invalid serviceConfig\.socksProxyUri/)
        // The echoed value is fully redacted (scheme-less values borrow their scheme label).
        assert.match(error.message, /\*\*\*:\*\*\*@host:1080/)
        assert.ok(!error.message.includes('secret'), `the password must not leak for ${uri}`)
        assert.ok(!error.message.includes('user:secret'), `the userinfo must not leak for ${uri}`)
        return true
      },
    )
  }
})

test('createSocksAgent validates the URI and builds a keep-alive agent', () => {
  const agent = createSocksAgent('socks5://127.0.0.1:1080')
  assert.equal(agent.keepAlive, true)
  assert.throws(() => createSocksAgent('ftp://127.0.0.1:1080'), /Invalid serviceConfig\.socksProxyUri/)
})

test('the shared agent is exposed on the client, REST wrapper and WebSocket client', () => {
  const withoutProxy = new Kraken(undefined, {})
  assert.equal(withoutProxy.agent, undefined)
  assert.equal(withoutProxy.rest.agent, undefined)
  assert.equal(withoutProxy.ws.agent, undefined)
  withoutProxy.ws.close()

  const withProxy = new Kraken(undefined, { socksProxyUri: 'socks5://127.0.0.1:1080' })
  assert.ok(withProxy.agent)
  assert.equal(withProxy.agent, withProxy.rest.agent)
  assert.equal(withProxy.agent, withProxy.ws.agent)
  withProxy.ws.close()
})

test('the agent property is read-only', () => {
  const kraken = new Kraken(undefined, { socksProxyUri: 'socks5://127.0.0.1:1080' })
  const original = kraken.agent

  kraken.ws.agent = 'nope'
  assert.equal(kraken.ws.agent, original)
  kraken.ws.close()
})
