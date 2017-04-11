var SocketPeer = require('../browser');
var test = require('tape');

test('connect_attempt event gets emitted', function (t) {
  var peer = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/',
    reconnect: false,
    timeout: 0
  });

  peer.on('connect_attempt', function () {
    t.ok(true, 'got connect_attempt event');
    t.equal(peer.socketConnected, false, 'peer.socketConnected');
    t.equal(peer._connections.socket.attempt, 1, 'peer._connections.socket.attempt');
    t.equal(peer._connections.socket.success, 0, 'peer._connections.socket.success');
    t.equal(peer._connections.socket.error, 0, 'peer._connections.socket.error');
    peer.destroy();
    t.end();
  });

  peer.on('error', function (err) {
    console.warn('Ignoring error: %s', err.message);
  });
});

test('basic lifecycle', function (t) {
  var peer1 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/',
    reconnect: false
  });

  var peer2 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/',
    reconnect: false
  });

  peer1.on('connect', function () {
    t.equal(peer1.socketConnected, true, 'peer1.socketConnected');
    t.equal(peer1._connections.socket.attempt, 0, 'peer1._connections.socket.attempt');
    t.equal(peer1._connections.socket.success, 1, 'peer1._connections.socket.success');
    t.equal(peer1._connections.socket.error, 0, 'peer1._connections.socket.error');
    tryConnect();
  });
  peer2.on('connect', function () {
    t.equal(peer2.socketConnected, true, 'peer2.socketConnected');
    t.equal(peer2._connections.socket.attempt, 0, 'peer2._connections.socket.attempt');
    t.equal(peer2._connections.socket.success, 1, 'peer2._connections.socket.success');
    t.equal(peer2._connections.socket.error, 0, 'peer2._connections.socket.error');
    tryConnect();
  });

  function tryConnect () {
    if (peer1.socketConnected && peer2.socketConnected) {
      t.ok(true, 'connected');

      peer1.send('ping');

      peer2.on('data', function (data) {
        if (data === 'ping') {
          t.ok(true, 'peer2 ping');
          peer2.send('pong');
        }
      });

      peer1.on('data', function (data) {
        if (data === 'pong') {
          t.ok(true, 'peer1 pong');

          peer1.destroy();
          peer2.destroy();

          t.end();
        }
      });
    }
  }
});

test('connect_timeout event gets emitted', function (t) {
  var peer = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/',
    timeout: 500
  });

  peer.on('connect_timeout', function () {
    t.ok(true, 'got connect_timeout event');
    t.equal(peer.socketConnected, false, 'peer.socketConnected');
  });

  peer.on('connect_error', function () {
    t.ok(true, 'got connect_error event');
  });

  peer.on('error', function () {
    t.ok(true, 'got error event');
    t.equal(peer._connections.socket.attempt, 1, 'peer._connections.socket.attempt');
    t.equal(peer._connections.socket.success, 0, 'peer._connections.socket.success');
    t.equal(peer._connections.socket.error, 1, 'peer._connections.socket.error');
    peer.destroy();
    t.end();
  });
});

test('message sent over WebSocket when RTC peer disconnects', function (t) {
  var peer1 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/',
    reconnect: false
  });

  var peer2 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/',
    reconnect: false
  });

  peer1.on('upgrade', tryUpgrade);
  peer2.on('upgrade', tryUpgrade);

  function tryUpgrade () {
    if (peer1.rtcConnected && peer2.rtcConnected) {
      t.ok(true, 'connected');
      sendPing();
    }
  }

  function sendPing () {
    peer1.send('ping');

    peer2.on('data', function (data) {
      if (data === 'ping') {
        t.ok(true, 'peer2 ping');
        sendPong();
      }
    });
  }

  function sendPong () {
    peer2.on('downgrade', function () {
      t.equal(peer2.rtcConnected, false, 'peer2.rtcConnected');

      peer2.send('pong');
      peer1.on('data', function (data) {
        t.equal(peer1.rtcConnected, false, 'peer1.rtcConnected');

        if (data === 'pong') {
          t.ok(true, 'peer1 pong');

          peer1.destroy();
          peer2.destroy();

          t.end();
        }
      });
    });

    peer2.destroyPeer();
  }
});

test('socket reconnects', function (t) {
  var peer1 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/'
  });

  var peer2 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/'
  });

  peer1.once('connect', tryConnect);
  peer2.once('connect', tryConnect);

  function tryConnect () {
    if (peer1.socketConnected && peer2.socketConnected) {
      t.ok(true, 'connected');

      peer1.once('reconnect', function () {
        t.equal(peer1.socketConnected, true, 'peer1.socketConnected');
        t.equal(peer2.socketConnected, true, 'peer2.socketConnected');

        peer1.destroy();
        peer2.destroy();
        t.end();
      });

      setTimeout(function () {
        peer1.socket.close();
      }, 0);
    }
  }
});

test('WebRTC reconnects', function (t) {
  var peer1 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/'
  });

  var peer2 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000/socketpeer/'
  });

  peer1.once('upgrade', tryUpgrade);
  peer2.once('upgrade', tryUpgrade);

  function tryUpgrade () {
    if (peer1.rtcConnected && peer2.rtcConnected) {
      t.ok(true, 'upgrade');

      peer1.once('downgrade', function () {
        t.ok(true, 'downgrade');

        t.equal(peer1.rtcConnected, false, 'peer1.rtcConnected');
      });

      peer1.once('upgrade', function () {
        t.ok(true, 'upgrade');

        t.equal(peer1.rtcConnected, true, 'peer1.rtcConnected');

        peer1.destroy();
        peer2.destroy();
        t.end();
      });

      peer1.destroyPeer();
    }
  }
});
