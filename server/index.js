var fs = require('fs');
var http = require('http');
var path = require('path');

var ws = require('ws');

var nodeEnv = process.env.NODE_ENVIRONMENT || 'development';
var WebSocketServer = ws.Server;


function Server(opts) {
  opts = opts || {};

  if (!opts.connectionListener) {
    opts.connectionListener = function (req, res) {
      var url = req.url.split('?')[0];
      if (url === '/demo.html') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        var stream = fs.createReadStream(path.join(__dirname, '..' + url));
        stream.pipe(res);
      }
      if (url === '/socketpeer.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        var stream = fs.createReadStream(path.join(__dirname, '..' + url));
        stream.pipe(res);
      }
    };
  }

  if (!opts.httpServer) {
    var host = opts.host || process.env.SOCKETPEER_HOST || process.env.HOST || '0.0.0.0';
    var port = opts.port || process.env.SOCKETPEER_PORT || process.env.PORT || 3000;
    opts.httpServer = http.createServer(opts.connectionListener);

    opts.httpServer.listen(port, host, function () {
      console.log('[%s] Server listening on %s:%s', nodeEnv, host, port);
    });
  }

  if (!opts.wsServer) {
    opts.wsServer = new WebSocketServer({
      server: opts.httpServer
    });
  }

  var peersWaiting = Object.create(null);
  var connections = Object.create(null);

  function closeConnection(pairCode) {
    connections[pairCode].forEach(function (conn) {
      conn.peer = null;
    });
    connections[pairCode] = null;
  }

  function sendMessage(type, data) {
    this.send(JSON.stringify({
      type: type,
      data: data
    }));
  }

  opts.wsServer.on('connection', function connection(client) {

    client.sendMessage = sendMessage.bind(client);

    console.log('Connection');

    client.on('message', function incoming(msg) {
      console.log('[message] Received message: %s', msg);

      var obj = JSON.parse(msg);
      client.emit('message.' + obj.type, obj.data);
    });

    client.on('message.data', function (data) {
      console.log('[pair] Received data:', data);

      if (client.peer) {
        client.peer.sendMessage('data', data);
      }
    });

    client.on('message.pair', function (pairCode) {
      console.log('[pair] Received pairCode:', pairCode);

      client.pairCode = pairCode;

      var waiting = peersWaiting[pairCode];

      if (waiting && waiting !== client) {
        console.log('[pair] Other peer found');

        client.peer = waiting;
        waiting.peer = client;
        connections[pairCode] = [client, waiting];
        peersWaiting[pairCode] = null;
        waiting.sendMessage('peer.found', {initiator: false});
        client.sendMessage('peer.found', {initiator: true});
      } else {
        console.log('[pair] No other peer found');
        // I am waiting for you.
        peersWaiting[pairCode] = client;
      }
    });

    client.on('message.rtc.signal', function (data) {
      console.log('[rtc.signal] Signal recieved');
      if (client.peer) {
        client.peer.sendMessage('rtc.signal', data);
      } else {
        console.warn('[rtc.signal] Signal with no peer!');
      }
    });

    client.on('message.rtc.close', function (data) {
      var peer = client.peer;
      var pairCode = data.pairCode;
      if (peer) {
        peer.peer = null;
        client.peer = null;
      }
      peersWaiting[pairCode] = client;
    });

    client.on('close', function () {
      if (client.pairCode in peersWaiting &&
          peersWaiting[client.pairCode] === client) {

        peersWaiting[client.pairCode] = null;
      }

      if (client.peer) {
        peersWaiting[client.pairCode] = client.peer;
        closeConnection(client.pairCode);
      }
    });

    // TODO: Emit an error if third peer tries to join with same pairCode.
  });

  return opts.httpServer;
}


// Immediately start the server if the server is called directly
// (i.e., not required as a module).
if (require.main === module) {
  Server();
}


module.exports = Server;
