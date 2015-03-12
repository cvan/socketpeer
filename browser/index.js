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

  this.peer = null;

  this.socketConnected = false;
  this.rtcConnected = false;

  this._connections = {
    socket: {success: 0, error: 0, attempt: 0},
    rtc: {success: 0, error: 0, attempt: 0}
  };

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

  self.on('peer.found', self._rtcInit);
  self.on('rtc.signal', self._rtcSignal);

  if (this.autoconnect) {
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

  self.emit('connect_attempt');
  if (self._connections.socket.success > 0) {
    self.emit('reconnect_attempt');
  }

  var connectTimeout = setTimeout(function () {
    if (!self.socketConnected) {
      self.close();
    }
  }, self.timeout);

  self.socket = new WebSocket(self.url.replace(/^http/, 'ws'));
  self.socket.onopen = function () {
    self.socketConnected = true;
    self._connections.socket.success++;
    self._connections.socket.attempt = 0;
    self.emit('connect');
    if (self._connections.socket.success > 0) {
      self.emit('reconnect');
    }

    self.pair();
  };
  self.socket.onerror = function (err) {
    self._connections.socket.error++;
    self.emit('error', err);
    self.emit('connect_error', err);
    if (self._connections.socket.success > 0) {
      self.emit('reconnect_error');
    }
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
  self.socket.onclose = function () {
    self.socketConnected = false;
    self._debug('close');

    if (self.reconnect) {
      var delay = self._calcReconnectTimeout(self._connections.socket.attempt);
      clearTimeout(self._socketReconnectTimeout);
      self._socketReconnectTimeout = setTimeout(function () {
        self.connect();
      }, delay);
    }
  };

  clearTimeout(connectTimeout);
};


SocketPeer.prototype._calcReconnectTimeout = function (attempts) {
  return Math.min(Math.pow(2, attempts) * self.reconnectDelay, 30000);
};


SocketPeer.prototype._rtcInit = function (data) {
  var self = this;

  if (self.rtcConnected) {
    console.warn('WebRTC peer already connected');
    return;
  }

  self._connections.rtc.attempt++;
  self.emit('upgrade_attempt');

  self.peer = new SimplePeer({
    initiator: !!data.initiator
  });

  self.peer.on('connect', function () {
    self._connections.rtc.success++;
    self._connections.rtc.attempt = 0;
    self.emit('upgrade');
    self.rtcConnected = true;
  });

  self.peer.on('error', function (err) {
    self._connections.rtc.error++;
    self.emit('error', err);
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
    self._send('rtc.close', {pairCode: self.pairCode});

    if (self.socketConnected) {
      var delay = self._calcReconnectTimeout(self._connections.rtc.attempt);
      clearTimeout(self._rtcReconnectTimeout);
      self._rtcReconnectTimeout = setTimeout(function () {
        self.pair();
      }, delay);
    }
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
  self.socket.close();
  self.peer.destroy();
};


SocketPeer.prototype._debug = function () {
  var self = this;
  var args = Array.prototype.slice.call(arguments);
  args[0] = '[' + self.pairCode + '] ' + args[0];
  console.log.apply(console, args);
};


module.exports = SocketPeer;
