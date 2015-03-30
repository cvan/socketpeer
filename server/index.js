var fs = require('fs');
var http = require('http');
var path = require('path');
var urllib = require('url');

var ws = require('ws');

var nodeEnv = process.env.NODE_ENVIRONMENT || 'development';
var WebSocketServer = ws.Server;


function Server(opts) {
  opts = opts || {};

  if (!opts.httpServer) {
    var host = opts.host || process.env.SOCKETPEER_HOST || process.env.HOST || '0.0.0.0';
    var port = opts.port || process.env.SOCKETPEER_PORT || process.env.PORT || 3000;
    opts.httpServer = http.createServer();

    opts.httpServer.listen(port, host, function () {
      console.log('[%s] Server listening on %s:%s', nodeEnv, host, port);
    });
  }

  if (typeof opts.serveLibrary === 'undefined' || opts.serveLibrary) {
    opts.httpServer.on('request', function (req, res) {
      var url = urllib.parse(req.url).pathname;
      if (url === '/socketpeer/socketpeer.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        var stream = fs.createReadStream(path.join(__dirname, '..', 'socketpeer.js'));
        stream.pipe(res);
      }
    });
  }

  if (!opts.wsServer) {
    opts.wsServer = new WebSocketServer({
      server: opts.httpServer,
      path: '/socketpeer/'
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

      if (connections[pairCode]) {
        client.sendMessage('busy');
        return;
      }

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

    client.on('message.rtc.connect', function () {
      console.log('[rtc.connect] Received');

      if (client.peer) {
        client.peer.sendMessage('rtc.connect');
      }
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
  });

  return opts.httpServer;
}


// Immediately start the server if the server is called directly
// (i.e., not required as a module).
if (require.main === module) {
  Server();
}


module.exports = Server;
