/* jshint node: true */

const fs = require('fs');
const http = require('http');
const path = require('path');
const urllib = require('url');

const ws = require('ws');

const nodeEnv = process.env.NODE_ENV || 'development';
const WebSocketServer = ws.Server;

function SocketPeerServer (opts) {
  opts = opts || {};

  if (!opts.httpServer) {
    const host = opts.host || process.env.SOCKETPEER_HOST || process.env.HOST || '0.0.0.0';
    const port = opts.port || process.env.SOCKETPEER_PORT || process.env.PORT || 3000;

    opts.httpServer = http.createServer((req, res) => {
      var url = urllib.parse(req.url).pathname;

      if (nodeEnv === 'development') {
        let stream;
        // For demo purposes.
        if (url === '/' || url === '/demo/') {
          // res.writeHead(200, {'Content-Type': 'text/html'});
          stream = fs.createReadStream(path.join(__dirname, '..', 'demo', 'index.html'));
          stream.pipe(res);
        }
        if (url === '/media/') {
          // res.writeHead(200, {'Content-Type': 'text/html'});
          stream = fs.createReadStream(path.join(__dirname, '..', 'demo', 'media.html'));
          stream.pipe(res);
        }
      }
    });

    opts.httpServer.listen(port, host, () => {
      console.log('[%s] Server listening on %s:%s', nodeEnv, host, port);
    });
  }

  if (typeof opts.serveLibrary === 'undefined' || opts.serveLibrary) {
    opts.httpServer.on('request', (req, res) => {
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

  function closeConnection (pairCode) {
    connections[pairCode].forEach(conn => {
      conn.peer = null;
    });
    connections[pairCode] = null;
  }

  function sendMessage (type, data) {
    this.send(JSON.stringify({
      type: type,
      data: data
    }));
  }

  opts.wsServer.on('connection', client => {
    client.sendMessage = sendMessage.bind(client);

    console.log('Connection');

    client.on('message', msg => {
      console.log('[message] Received message: %s', msg);

      var obj = JSON.parse(msg);
      client.emit('message.' + obj.type, obj.data);
    });

    client.on('message.data', data => {
      console.log('[pair] Received data:', data);

      if (client.peer) {
        client.peer.sendMessage('data', data);
      }
    });

    client.on('message.pair', pairCode => {
      console.log('[pair] Received pairCode:', pairCode);

      if (connections[pairCode]) {
        client.sendMessage('busy');
        return;
      }

      client.pairCode = pairCode;

      (peersWaiting[pairCode] || []).forEach(waiting => {
        if (waiting && waiting !== client) {
          console.log('[pair] Other peer found');

          client.peer = waiting;
          waiting.peer = client;
          connections[pairCode] = [client, waiting];
          // peersWaiting[pairCode] = null;
          waiting.sendMessage('peer.found', {initiator: false});
          client.sendMessage('peer.found', {initiator: true});
        } else {
          console.log('[pair] No other peer found');
          // I am waiting for you.
          // peersWaiting[pairCode] = client;
          if (peersWaiting[pairCode]) {
            peersWaiting[pairCode].push(client);
          } else {
            peersWaiting[pairCode] = [client];
          }
        }
      });
    });

    client.on('message.rtc.signal', data => {
      console.log('[rtc.signal] Signal recieved');

      if (client.peer) {
        client.peer.sendMessage('rtc.signal', data);
      } else {
        console.warn('[rtc.signal] Signal with no peer!');
      }
    });

    client.on('message.rtc.connect', () => {
      console.log('[rtc.connect] Received');

      if (client.peer) {
        client.peer.sendMessage('rtc.connect');
      }
    });

    client.on('close', () => {
      if (client.pairCode in peersWaiting) {
        const clientIdx = peersWaiting[client.pairCode].indexOf(client);
        if (clientIdx > -1) {
          peersWaiting[client.pairCode].splice(peersWaiting[client.pairCode].indexOf(client));
        }
      }

      // if (client.pairCode in peersWaiting &&
      //     peersWaiting[client.pairCode] === client) {
      //   peersWaiting[client.pairCode] = null;
      // }

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
  SocketPeerServer();
}

module.exports = SocketPeerServer;
