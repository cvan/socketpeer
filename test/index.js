var SocketPeer = require('../server');
var test = require('tape');


test('connect_attempt event gets emitted', function (t) {

  var peer = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000'
  });

  peer.on('connect_attempt', function () {
    t.pass('got connect_attempt event');
    t.equal(peer.socketConnected, false);
    t.equal(peer._connections.socket.attempt, 1);
    t.equal(peer._connections.socket.success, 0);
    t.equal(peer._connections.socket.error, 0);
    peer.destroy();
    t.end();
  });

});


test('basic lifecycle', function (t) {

  var peer1 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000',
    reconnect: false,
  });

  var peer2 = new SocketPeer({
    pairCode: 'yolo',
    url: 'http://localhost:3000',
    reconnect: false,
  });

  peer1.on('connect', function () {
    t.equal(peer1.socketConnected, true);
    t.equal(peer1._connections.socket.attempt, 0);
    t.equal(peer1._connections.socket.success, 1);
    t.equal(peer1._connections.socket.error, 0);
    tryConnect();
  });
  peer2.on('connect', function () {
    t.equal(peer2.socketConnected, true);
    t.equal(peer2._connections.socket.attempt, 0);
    t.equal(peer2._connections.socket.success, 1);
    t.equal(peer2._connections.socket.error, 0);
    tryConnect();
  });

  function tryConnect() {
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
    url: 'http://localhost:3000',
    timeout: 500
  });

  peer.on('connect_timeout', function () {
    t.ok(true, 'got connect_timeout event');
    t.equal(peer.socketConnected, false);
  });

  peer.on('connect_error', function () {
    t.ok(true, 'got connect_error event');
  });

  peer.on('error', function () {
    t.ok(true, 'got error event');
    t.equal(peer._connections.socket.attempt, 1, 'connect_timeout.attempt');
    t.equal(peer._connections.socket.success, 0, 'connect_timeout.success');
    t.equal(peer._connections.socket.error, 1, 'connect_timeout.error');
    peer.destroy();
    t.end();
  });

});
