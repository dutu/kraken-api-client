# kraken-api-client

## Configuration

The second argument of the `Kraken` constructor (`serviceConfig`) configures optional service features.

### SOCKS proxy

Set `serviceConfig.socksProxyUri` to route all REST requests, WebSocket token requests and WebSocket
upgrades through a SOCKS proxy. A single shared agent is used for every connection, so the client
never falls back to a direct connection.

```javascript
import Kraken from 'kraken-api-client'

const kraken = new Kraken(
  { apiKey: 'your_api_key', apiSecret: 'your_api_secret' },
  { socksProxyUri: 'socks5h://user:password@127.0.0.1:1080' },
)
```

- Supported schemes: `socks:`, `socks4:`, `socks4a:`, `socks5:` and `socks5h:`.
- Optional credentials may be embedded as `user:password@`.
- The host and an explicit port are **required** (there is no default port).
- `socks5:`/`socks4:` resolve the destination hostname locally, while `socks5h:`/`socks4a:`/`socks:`
  let the proxy resolve it.
- Invalid values throw at construction (e.g. an unsupported scheme or a missing port).
- Proxy credentials are masked (`***:***`) in every error message and log line.
- Connections to the proxy are kept alive; the existing per-request headers and timeouts are unchanged.

### Advanced endpoint overrides

`serviceConfig.baseUrls` (merged over
`{ production: 'https://api.kraken.com', public: 'https://api.kraken.com', futures: 'https://futures.kraken.com' }`)
and `serviceConfig.webSocketEndpoints` (merged over the public/private `wss://ws*.kraken.com`
defaults) override the REST and WebSocket endpoints. They are intended for advanced setups and tests.

## Testing

```
yarn test
```

The hermetic proxy tests bind loopback servers (a minimal SOCKS5 proxy plus local HTTP and
WebSocket targets), so they must be able to listen on `127.0.0.1`.

## Orderbook

### Methods

#### on(`'orderbook'`, listener)

#### subscribe({ symbol, depth })
Will throw error if invoked twice

#### unsubscribe ( { symbol })
Will throw error if subscription for symbol does not exist.

### Events

#### `subscribe`

#### `unsubscribe`

#### `orderbook`

####
