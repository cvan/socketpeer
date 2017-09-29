# SocketPeer

Simple 1:1 messaging via [WebRTC Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel) and [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).

[Read this great **walk-through article**.](https://hacks.mozilla.org/2015/04/peering-through-the-webrtc-fog-with-socketpeer/)

[**View a live demo** of a project using SocketPeer!](https://socketpeer-test.herokuapp.com/) See the (project's [source code](https://github.com/potch/test-socketpeer)).


## Features

* concise, [Node.js](https://nodejs.org/)-style API for **[WebRTC](https://en.wikipedia.org/wiki/WebRTC)** peer-to-peer connections
* simple 1:1 peer connection signalling, pairing, and messaging
* fallback WebSocket support if WebRTC Data Channels are unsupported
* automatic reconnection if peer connections prematurely close
* exports as a [UMD](https://github.com/umdjs/umd) module, so the library works everywhere (i.e., using [Browserify](http://browserify.org/), [webpack](https://webpack.js.org/), or included by a `<script>` tag in any modern browser)


## Usage

If you are requiring `socketpeer` as a Node package using [`npm`](https://www.npmjs.com)/[`yarn`](https://yarnpkg.com/) + [Browserify](http://browserify.org/)/[webpack](https://webpack.js.org/), install the [`socketpeer` package](https://www.npmjs.com/package/socketpeer) from your project directory like so:

```sh
npm install socketpeer --save
```

> **NOTE:** If you are **not** using Browserify/webpack, then use the included standalone file, [`socketpeer.min.js`](socketpeer.min.js), which exports to `window` a function called `SocketPeer`.

[Read this great **walk-through article**.](https://hacks.mozilla.org/2015/04/peering-through-the-webrtc-fog-with-socketpeer/)

[**View a live demo** of a project using SocketPeer!](https://socketpeer-test.herokuapp.com/) See the (project's [source code](https://github.com/potch/test-socketpeer)).

Additionally, here's some sample code to quickly get you started using `socketpeer`:

```js
var socketpeer = require('socketpeer');

var peer = new SocketPeer({
  pairCode: 'yolo',
  url: 'http://localhost:3000/socketpeer/'
});

peer.on('connect', function () {
  console.log('peer connected');
});

peer.on('connect_timeout', function () {
  console.error('connection timed out (after %s ms)', peer.timeout);
});

peer.on('data', function (data) {
  console.log('data received:', data);
});

peer.on('rtc.signal', function () {
  console.log('WebRTC signalling');
});

peer.on('peer.found', function (data) {
  console.log('peer found:', data.initiator);
  peer.send('hello');
});

peer.on('upgrade', function () {
  console.log('successfully upgraded WebSocket ⇒ to WebRTC peer connection');
  peer.send('upgraded');
});

peer.on('upgrade_attempt', function () {
  console.log('attempting to upgrade WebSocket ⇒ to WebRTC peer connection (attempt number: %d)', peer._connections.rtc.attempt);
});

peer.on('downgrade', function () {
  console.log('downgraded WebRTC peer connection ⇒ to WebSocket connection');
});

peer.on('warning', function (data) {
  console.error('warning:', data.message);
});

peer.on('error', function (err) {
  console.error('error:', err);
});
```

For more examples, refer to the [`demo` directory](https://github.com/cvan/socketpeer/tree/master/demo).


## Development

### Installation

1. If you haven't already, install [Node.js](https://nodejs.org/en/download/package-manager/) (which includes [`npm`](https://www.npmjs.com/)).
2. Clone this repository ([`cvan/socketpeer`](https://github.com/cvan/socketpeer)):

    ```sh
    git clone git@github.com:cvan/socketpeer.git
    ```
3. In the root directory of the cloned repository of the project, install the [Node](https://nodejs.org/en/download/package-manager/) dependencies:

    ```sh
    cd cvan/socketpeer/
    npm install
    ```

4. When all the latest dependencies are installed, from the `socketpeer/` directory, run these commands (each in a separate terminal tab):

    ```sh
    # Start the server for local development (includes server live-reloading).
    npm start

    # Run the Browserify watcher (files are written to the `build/` directory).
    npm run watch
    ```

    This will generate a non-minified version of the library and will run a watcher which recompiles the `socketpeer` library when local changes are saved to disk.


### Commands (`npm` scripts) for local development

* **`npm run build`** (or `npm run dist`) – builds the distribution-ready files for `SocketPeer` (i.e., [`socketpeer.js`](socketpeer.js), [`socketpeer.min.js`](socketpeer.min.js)), to the root project directory.
* **`npm start`** (or `npm run dev`) – builds the development version of the library and runs a file watcher.
* **`npm run test`** – runs the tests.
* **`npm run test-local`** – runs the tests in a continuous-watch mode (useful for local, test-driven development).
* **`npm run release`** – deploy the current project directory as a module to `npm` as the [`socketpeer` package](https://www.npmjs.com/package/socketpeer).

## Distribution

To build the Browserify bundles:

```sh
npm run build
```

Two files will be written to this project's root directory:

* **[`socketpeer.js`](socketpeer.js)** – the development/debug-purposed, unminified version of `SocketPeer` (UMD-compatible).
* **[`socketpeer.min.js`](socketpeer.min.js)** – the production-ready, minified version of `SocketPeer` (UMD-compatible).



## Tests

Refer to these docs for setting up continuous-integration testing locally:

* [Sauce Labs](https://github.com/defunctzombie/zuul/wiki/cloud-testing)
* [Travis CI](https://github.com/defunctzombie/zuul/wiki/Travis-ci)

To run the tests intended for a local environment:

```sh
npm run test-local
```

To run the tests in "the cloud" (e.g., [Sauce Labs](https://saucelabs.com/), [Travis CI](https://travis-ci.org/)):

```sh
npm test
```


## Client API

### `peer = new SocketPeer([opts])`

Create a new peer WebRTC Data Channel peer connection (only WebRTC if `socketFallback` is `false`).

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
  autoconnect: true,
  serveLibrary: true,
  debug: false
}
```

The options do the following:

* `pairCode` - string used to identify peers
* `socketFallback` - when `true`, falls back to WebSockets when WebRTC is unavailable
* `socket` - custom instance of a WebSocket connection to reuse
* `url` - URL to WebSocket server
* `reconnect` - when `true`, reconnects if peer connection drops
* `reconnectDelay` - if `reconnect` is set, how long to wait (in milliseconds) before reconnecting
* `timeout` - how long to wait (in milliseconds) before abandoning connection
* `autoconnect` - when `true`, automatically connects upon page load
* `serveLibrary` - when `true`, serves library at `/socketpeer/socketpeer.js`
* `debug` - when `true`, logs debugging information to the `console`

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


## Events

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

### `peerServer = new SocketPeerServer([opts])`

Create a new server for establishing peer connections (i.e., "signalling") and passing WebSocket messages through (if WebRTC Data Channel not supported).

If `httpServer` is specified, that existing server will be used instead and a `ws.Server` will be created and attached to it. To use an existing `ws.Server` for signalling, pass `wsServer`.

If `opts` is specified, then the default options (shown below) will be overridden.

```js
{
  allowedOrigins: [Array],
  httpServer: undefined,
  wsServer: undefined,
  peerTimeout: 60000,
  pairCodeValidator: function (pairCode) {}
}
```

The options do the following:

* `allowedOrigins` - array of allowed/whitelisted origins (optional)
* `peerTimeout` - how long to wait (in milliseconds) before abandoning peer connection (defaults to 6000 milliseconds / 1 minute)
* `pairCodeValidator` - function that allows custom validation on the `pairCode` passed from the client (optional)

### `peerServer.socket`

A property that links to the instance of [**`ws.Server`**](https://github.com/websockets/ws).

### `peerServer.server`

A property that links to the instance of `http.Server`.

### `peerServer.leave(pairCode)`

Breaks both ends of a peer connection (WebSocket or WebRTC).


## Contributing

[Contributions are very welcome!](CONTRIBUTING.md)


## Acknowledgments

Thank you to the following projects and individuals:

* [`simple-peer`](https://github.com/feross/simple-peer) (Licensed under [MIT](https://github.com/feross/simple-peer/blob/master/LICENSE))


## Licence

[MIT Licence.](LICENCE)
