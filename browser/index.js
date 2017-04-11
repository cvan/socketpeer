/* jshint browserify: true */
/* global WebSocket */

var events = require('events');
var inherits = require('inherits');  // A tiny lib containing `util.inherits`.

var extend = require('xtend/mutable');
var SimplePeer = require('simple-peer');

var EventEmitter = events.EventEmitter;

/**
 * A WebRTC/WebSocket peer connection.
 * @param {Object} opts
 */
function SocketPeer (opts) {
  var self = this;

  if (!(self instanceof SocketPeer)) {
    return new SocketPeer(opts);
  }

  opts = opts || {};

  EventEmitter.call(self);

  self._connections = {
    socket: {success: 0, error: 0, attempt: 0},
    rtc: {success: 0, error: 0, attempt: 0}
  };
  self.peer = null;
  self.rtcConnected = false;
  self.socketConnected = false;

  extend(self, {
    pairCode: 'pairCode' in opts ? opts.pairCode : null,
    socketFallback: 'socketFallback' in opts ? opts.socketFallback : true,
    socket: 'socket' in opts ? opts.socket : null,
    stream: 'stream' in opts ? opts.stream : null,
    url: 'url' in opts ? opts.url : 'http://localhost',
    reconnect: 'reconnect' in opts ? opts.reconnect : true,
    reconnectDelay: 'reconnectDelay' in opts ? opts.reconnectDelay : 1000,
    timeout: 'timeout' in opts ? opts.timeout : 0,
    autoconnect: 'autoconnect' in opts ? opts.autoconnect : true,
    debug: 'debug' in opts ? opts.debug : false
  }, opts);

  self._debug('New peer');

  self.on('peer.found', function (data) {
    self.socketConnected = true;
    clearTimeout(self._socketConnectTimeout);
    clearTimeout(self._socketReconnectDelayTimeout);
    self._connections.socket.attempt = 0;
    self._connections.socket.success++;

    self.emit('connect');
    if (self._connections.socket.success > 0) {
      self.emit('reconnect');
    }

    self.initiator = data.initiator;

    if (data.initiator) {
      self._send('rtc.connect');
      self._rtcInit();
    }
  });
  self.on('rtc.signal', self._rtcSignal);
  self.on('rtc.connect', function () {
    self._rtcInit();
  });

  self.on('busy', function () {
    self._socketError(new Error('Pair code "' + self.pairCode + '" already in use'));
    self.socket.close();
  });

  if (self.autoconnect) {
    setTimeout(function () {
      self.connect();
    }, 0);
  }
}

inherits(SocketPeer, EventEmitter);

SocketPeer.prototype.pair = function (pairCode) {
  var self = this;

  if (typeof pairCode !== 'undefined') {
    self.pairCode = pairCode;
  }

  self._send('pair', self.pairCode);
};

SocketPeer.prototype.connect = function () {
  var self = this;

  self._connections.socket.attempt++;

  if (self.socketConnected) {
    console.warn('Socket already connected');
    return;
  }

  if (self.timeout) {
    self._socketConnectTimeout = setTimeout(function () {
      self.socket.close();
      var err = new Error('Connection timeout after ' + self.timeout + ' ms');
      self.emit('connect_timeout', err);
      self._socketError(err);
    }, self.timeout);
  }

  self.socket = new WebSocket(self.url.replace(/^http/, 'ws'));
  self.socket.onopen = function () {
    self.pair();
  };
  self.socket.onerror = function (event) {
    self._socketError(new Error(event.data || 'Unexpected WebSocket error'));
  };
  self.socket.onmessage = function (event) {
    var obj = {};
    try {
      obj = JSON.parse(event.data);
    } catch (e) {
      self.emit(new Error('Expected JSON-formatted WebSocket message'));
    }

    if (obj.type === 'data') {
      self.emit('data', obj.data);
    } else {
      self.emit(obj.type, obj.data);
    }
  };
  self.socket.onclose = function () {
    self.socketConnected = false;
    self._debug('close');

    if (self.reconnect) {
      var delay = self._calcReconnectTimeout(self._connections.socket.attempt);
      clearTimeout(self._socketReconnectDelayTimeout);
      self._socketReconnectDelayTimeout = setTimeout(function () {
        self.connect();
      }, delay);
    }
  };

  self.emit('connect_attempt');
  if (self._connections.socket.success > 0) {
    self.emit('reconnect_attempt');
  }
};

SocketPeer.prototype._socketError = function (err) {
  var self = this;
  self._connections.socket.error++;
  self.emit('error', err);
  self.emit('connect_error', err);
  if (self._connections.socket.success > 0) {
    self.emit('reconnect_error');
  }
};

SocketPeer.prototype._calcReconnectTimeout = function (attempts) {
  var self = this;
  return Math.min(Math.pow(2, attempts) * self.reconnectDelay, 30000);
};

SocketPeer.prototype._rtcInit = function () {
  var self = this;

  if (self.rtcConnected) {
    console.warn('WebRTC peer already connected');
    return;
  }

  self.peer = new SimplePeer({
    initiator: self.initiator,
    stream: self.stream
  });

  self.peer.on('connect', function () {
    clearTimeout(self._rtcReconnectTimeout);
    self._connections.rtc.success++;
    self._connections.rtc.attempt = 0;
    self.rtcConnected = true;
    self.emit('upgrade');
  });

  self.peer.on('stream', function (stream) {
    self.emit('stream', stream);
  });

  self.peer.on('error', function (err) {
    self._connections.rtc.error++;
    self.emit('upgrade_error', err);
    self.emit('error', err);
  });

  self.peer.on('signal', function (data) {
    if (self.rtcConnected) {
      return;
    }
    self._send('rtc.signal', data);
  });

  self.peer.on('data', function (data) {
    self.emit('data', data);
  });

  self.peer.on('close', function (data) {
    self.destroyPeer();

    if (self.socketConnected) {
      // NOTE: Currently the server does nothing with this message.
      // self._send('rtc.close', {pairCode: self.pairCode});

      if (self.reconnect && self.initiator) {
        var delay = self._calcReconnectTimeout(self._connections.rtc.attempt);
        clearTimeout(self._rtcReconnectTimeout);
        self._rtcReconnectTimeout = setTimeout(function () {
          self._send('rtc.connect');
          self._rtcInit();
        }, delay);
      }
    }

    self.emit('downgrade');
  });

  self._connections.rtc.attempt++;
  self.emit('upgrade_attempt');
};

SocketPeer.prototype._rtcSignal = function (data) {
  var self = this;
  if (!self.rtcConnected && self.peer && !self.peer.destroyed) {
    self.peer.signal(data);
  }
};

SocketPeer.prototype._send = function (type, data) {
  var self = this;
  if (!self.socket) {
    console.warn('Attempted to send message when socket was closed: %s', type);
    return;
  }
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
  self.destroyPeer();
  if (self.socket) {
    self.socket.close();
  }
};

SocketPeer.prototype.destroy = function () {
  var self = this;
  self.reconnect = false;
  self.close();
  self.peer = null;
  self.socket = null;
  self.socketConnected = false;
  self.rtcConnected = false;
  clearTimeout(self._socketConnectTimeout);
  clearTimeout(self._socketReconnectDelayTimeout);
  clearTimeout(self._rtcReconnectTimeout);
};

SocketPeer.prototype.destroyPeer = function () {
  var self = this;
  if (self.peer) {
    self.peer.destroy();
  }
  self.peer = null;
  self.rtcConnected = false;
};

SocketPeer.prototype._debug = function () {
  var self = this;
  if (self.debug) {
    var args = Array.prototype.slice.call(arguments);
    args[0] = '[' + self.pairCode + '] ' + args[0];
    console.log.apply(console, args);
  }
};

module.exports = SocketPeer;
