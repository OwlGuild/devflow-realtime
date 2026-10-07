import { WebSocketServer } from 'ws';

const port = parseInt(process.env.PORT || '8080');
const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', service: 'devflow-realtime' }));
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      ws.send(JSON.stringify({ type: 'echo', received: msg }));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
    }
  });
});

console.log(`devflow-realtime listening on :${port}`);
