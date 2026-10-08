import { WebSocket, WebSocketServer } from 'ws';

const MAX_PAYLOAD_BYTES = 1_000_000;
const HEARTBEAT_MS = 30_000;

const rawPort = Number.parseInt(process.env.PORT ?? '8080', 10);
if (!Number.isInteger(rawPort) || rawPort < 0 || rawPort > 65535) {
  console.error(`invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

const wss = new WebSocketServer({ port: rawPort, maxPayload: MAX_PAYLOAD_BYTES });
const clients = new Set<WebSocket>();
const awaitingPong = new Set<WebSocket>();

wss.on('listening', () => {
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : rawPort;
  console.log(`devflow-realtime listening on :${port}`);
});

wss.on('error', (error) => {
  console.error('server error:', error.message);
  process.exit(1);
});

wss.on('connection', (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: 'connected', service: 'devflow-realtime' }));

  socket.on('error', (error) => {
    console.error('socket error:', error.message);
  });

  socket.on('pong', () => {
    awaitingPong.delete(socket);
  });

  socket.on('close', () => {
    clients.delete(socket);
    awaitingPong.delete(socket);
  });

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      socket.send(JSON.stringify({ type: 'echo', received: message }));
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
    }
  });
});

// Drop half-open sockets before they pile up on a long-lived instance.
const heartbeat = setInterval(() => {
  for (const socket of clients) {
    if (awaitingPong.has(socket)) {
      socket.terminate();
      continue;
    }
    awaitingPong.add(socket);
    socket.ping();
  }
}, HEARTBEAT_MS);

function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, closing`);
  clearInterval(heartbeat);
  for (const socket of clients) {
    socket.terminate();
  }
  wss.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
