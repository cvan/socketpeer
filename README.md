# socketpeer

Simple 1:1 messaging via WebRTC Data Channels and WebSockets.


## Features

* concise, Node.js-style API for **[WebRTC](https://en.wikipedia.org/wiki/WebRTC)**
* simple 1:1 peer connection signalling, pairing, and messaging
* fallback to WebSockets if WebRTC Data Channels are unsupported
* automatic reconnection if peer connections prematurely close

This module works great in the browser with [browserify](http://browserify.org/).

**NOTE:** If you are **not** using browserify, then use the included standalone file
`socketpeer.min.js`. This exports a `SocketPeer` function on `window`.


## Installation

To install from npm:

    npm install socketpeer

To install the Node dependencies from the git repository:

    npm install


## Development

To run the browserify watcher (files are output to the `build/` directory):

    npm run watch

To create the browserify bundles (files are output to the `build/` directory):

    npm run build


## Client API

### `peer = new SocketPeer([opts])`

Create a new peer WebRTC Data Channel peer connection (only WebSocket if `socketFallback` is `false`).

A "data channel" for text/binary communication is always established, because it's cheap and often useful.

If `opts` is specified, then the default options (shown below) will be overridden.

```js
{
  pairCode: '<random string>',
  socketFallback: true,
  socket: [Object],
  url: 'http://localhost',
  reconnect: true,
  reconnectDelay: 1000,
  timeout: 10000,
  autoconnect: true
}
```

The options do the following:

* `pairCode` - string used to identify peers
* `socketFallback` - set to `true` to fall back to WebSockets when WebRTC is unavailable
* `socket` - custom instance of a WebSocket connection to reuse
* `url` - URL to WebSocket server
* `reconnect` - set to `true` to reconnect if peer connection drops
* `reconnectDelay` - if `reconnect` is set, how long to (ms) wait before reconnecting
* `timeout` - how long to wait (ms) before abandoning connection
* `autoconnect` - set to `true` to automatically connect upon page load

### `peer.connect()`

If `reconnect` or `autoconnect` is `false`, manually start the connection.

### `peer.send(data)`

Send data to the remote peer.

### `peer.on(event, listener)`

Adds a listener to the end of the listeners array for the specified `event`.

### `peer.off(event)`

Remove listeners for the specified `event`.

SocketPeer extends Node's [`EventEmitter`](https://nodejs.org/api/events.html). See the docs for the remaining methods.

### `peer.close()`

Destroy and cleanup this peer connection.


## events

### `peer.on('connect', function () {})`

Fired when the peer connection and/or data channel is established.

### `peer.on('connect_error', function (data) {})`

Fired when a connection error occurs.

### `peer.on('connect_timeout', function (data) {})`

Fired when a connection timeout occurs.

### `peer.on('data', function (data) {})`

Received a message from the remote peer.

### `peer.on('reconnect', function (data) {})`

Fired when a reconnection occurs.

### `peer.on('reconnect_error', function (data) {})`

Fired when a reconnection error occurs.

### `peer.on('reconnect_timeout', function (data) {})`

Fired when a reconnection timeout occurs.

### `peer.on('upgrade', function (data) {})`

Fired when a connection is successfully upgraded from WebSocket to RTCDataChannel.

### `peer.on('upgrade_attempt', function (data) {})`

Fired when an upgrade attempt occurs.

### `peer.on('upgrade_error', function (data) {})`

Fired when an upgrade error occurs.

### `peer.on('downgrade', function (data) {})`

Fired when a connection falls back to WebSockets.

### `peer.on('close', function () {})`

Called when the peer connection has closed.

### `peer.on('busy', function (err) {})`

Fired when two clients are already connected using a same pair code. `err` is an `Error` object.

### `peer.on('error', function (err) {})`

Fired when an error occurs. `err` is an `Error` object.


## Server API

### `peerServer = new SocketPeerServer([server], [opts])`

Create a new server for establishing peer connections (i.e., "signalling") and passing WebSocket messages through (if WebRTC Data Channel not supported).

If `server` is specified, that existing server will be used instead. If you pass an `http.Server`, a `ws.Server` will be created and attached to it. Otherwise, pass an existing `ws.Server`.

If `opts` is specified, then the default options (shown below) will be overridden.

```js
{
  allowedOrigins: [Array],
  peerTimeout: 60000,
  pairCodeValidator: function (pairCode) {}
}
```

The options do the following:

* `allowedOrigins` - array of allowed origins (optional)
* `peerTimeout` - how long to wait before abandoning peer connection (defaults to 6000 ms, 1 minute)
* `pairCodeValidator` - function that allows custom validation on the `pairCode` passed from the client (optional)

### `peerServer.socket`

A property that links to the instance of [**`ws.Server`**](https://github.com/websockets/ws).

### `peerServer.server`

A property that links to the instance of `http.Server`.

### `peerServer.leave(pairCode)`

Breaks both ends of a peer connection (WebSocket or WebRTC).


## Licence

[MIT Licence](LICENCE)


## Contributing

[Contributions are very welcome!](CONTRIBUTING.md)
