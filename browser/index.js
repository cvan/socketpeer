var events = require('events');
var inherits = require('inherits');  // A tiny lib containing `util.inherits`.

var extend = require('xtend/mutable');
var SimplePeer = require('simple-peer');


var EventEmitter = events.EventEmitter;


/**
 * A WebRTC/WebSocket peer connection.
 * @param {Object} opts
 */
function SocketPeer(opts) {
  if (!(this instanceof SocketPeer)) {
    return new SocketPeer(opts);
  }
  opts = opts || {};

  EventEmitter.call(this);

  this.socketConnected = false;
  this.rtcConnected = false;

  extend(this, {
    pairCode: 'pairCode' in opts ? opts.pairCode : null,
    socketFallback: 'socketFallback' in opts ? opts.socketFallback : true,
    socket: 'socket' in opts ? opts.socket : null,
    url: 'url' in opts ? opts.url : 'http://localhost',
    reconnect: 'reconnect' in opts ? opts.reconnect : true,
    reconnectDelay: 'reconnectDelay' in opts ? opts.reconnectDelay : 1000,
    timeout: 'timeout' in opts ? opts.timeout : 100,
    autoconnect: 'autoconnect' in opts ? opts.autoconnect : true
  }, opts);

  this._debug('New peer');

  var self = this;

  if (this.autoconnect) {
    setTimeout(function () {
      self.connect();
    }, 0);
  }
}


inherits(SocketPeer, EventEmitter);


SocketPeer.prototype.connect = function () {
  var self = this;
  self.emit('connect_attempt');

  var connectTimeout = setTimeout(function () {
    if (!self.socketConnected) {
      self.close();
    }
  }, self.timeout);

  self.socket = new WebSocket(self.url.replace(/^http/, 'ws'));
  self.socket.onopen = function () {
    self.emit('connect');
    self._send('pair', self.pairCode);
  };
  self.socket.onerror = function () {
    self.emit('connect_error');
  };
  self.socket.onmessage = function (event) {
    var obj = {};
    try {
      obj = JSON.parse(event.data);
    } catch (e) {
    }

    if (obj.type === 'data') {
      self.emit('data', obj.data);
    } else {
      self.emit(obj.type, obj.data);
    }
  };

  self.on('peer.found', self._rtcInit);
  self.on('rtc.signal', self._rtcSignal);

  self.peer = null;

  clearTimeout(connectTimeout);
};


SocketPeer.prototype._rtcInit = function (data) {
  var self = this;

  self.emit('upgrade_attempt');

  self.peer = new SimplePeer({
    initiator: !!data.initiator
  });

  self.peer.on('connect', function () {
    self.emit('upgrade');
    self.rtcConnected = true;
  });

  self.peer.on('error', function (err) {
    self.emit('upgrade_error', err);
  });

  self.peer.on('signal', function (data) {
    self._send('rtc.signal', data);
  });

  self.peer.on('data', function (data) {
    self.emit('data', data);
  });

  self.peer.on('close', function (data) {
    self.emit('downgrade');
    self.rtcConnected = false;
  });
};


SocketPeer.prototype._rtcSignal = function (data) {
  var self = this;
  if (self.peer) {
    self.peer.signal(data);
  }
};


SocketPeer.prototype._send = function (type, data) {
  var self = this;
  data = JSON.stringify({
    type: type,
    data: data
  });
  self._debug('_send', data);
  self.socket.send(data);
};


SocketPeer.prototype.send = function (data) {
  var self = this;
  if (self.rtcConnected) {
    self.peer.send(data);
  } else {
    self._send('data', data);
  }
};


SocketPeer.prototype.close = function () {
  var self = this;
  self._debug('close');
};


SocketPeer.prototype._debug = function () {
  var self = this;
  var args = Array.prototype.slice.call(arguments);
  args[0] = '[' + self.pairCode + '] ' + args[0];
  console.log.apply(console, args);
};


module.exports = SocketPeer;
