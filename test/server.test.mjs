import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 31000 + Math.floor(Math.random() * 4000);
let child;

function open() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    ws.once('error', reject);
    ws.once('message', (data) => resolve({ ws, first: JSON.parse(data.toString()) }));
  });
}

function next(ws) {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    ws.once('error', reject);
  });
}

before(async () => {
  child = spawn(process.execPath, ['dist/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 700));
});

after(() => {
  if (child) child.kill();
});

test('greets a new connection', async () => {
  const { ws, first } = await open();
  assert.equal(first.type, 'connected');
  assert.equal(first.service, 'devflow-realtime');
  ws.close();
});

test('echoes a json message back', async () => {
  const { ws } = await open();
  const pending = next(ws);
  ws.send(JSON.stringify({ type: 'move', task: 42 }));
  const reply = await pending;
  assert.equal(reply.type, 'echo');
  assert.deepEqual(reply.received, { type: 'move', task: 42 });
  ws.close();
});

test('rejects invalid json without crashing', async () => {
  const { ws } = await open();
  const pending = next(ws);
  ws.send('not json');
  const reply = await pending;
  assert.equal(reply.type, 'error');
  assert.equal(reply.message, 'invalid json');
  ws.close();
});