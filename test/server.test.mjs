import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 31000 + Math.floor(Math.random() * 4000);
const STARTUP_DEADLINE_MS = 15000;

let child;
let stderr = '';

function open(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`no greeting within ${timeoutMs}ms\n${stderr}`));
    }, timeoutMs);
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve({ ws, first: JSON.parse(data.toString()) });
    });
  });
}

async function untilConnected() {
  const deadline = Date.now() + STARTUP_DEADLINE_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await open(Math.max(deadline - Date.now(), 1000));
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw lastError ?? new Error(`server never became reachable\n${stderr}`);
}

function next(ws, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no frame within ' + timeoutMs + 'ms')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

before(async () => {
  child = spawn(process.execPath, ['dist/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('exit', (code, signal) => {
    stderr += `\nserver exited unexpectedly (code=${code}, signal=${signal})`;
  });
  await untilConnected();
});

after(() => {
  if (child) child.kill();
});

test('greets a new connection', { timeout: 10000 }, async () => {
  const { ws, first } = await open();
  assert.equal(first.type, 'connected');
  assert.equal(first.service, 'devflow-realtime');
  ws.close();
});

test('echoes a json message back', { timeout: 10000 }, async () => {
  const { ws } = await open();
  const pending = next(ws);
  ws.send(JSON.stringify({ type: 'move', task: 42 }));
  const reply = await pending;
  assert.equal(reply.type, 'echo');
  assert.deepEqual(reply.received, { type: 'move', task: 42 });
  ws.close();
});

test('rejects invalid json and keeps serving new connections', { timeout: 15000 }, async () => {
  const { ws } = await open();
  const pending = next(ws);
  ws.send('not json');
  const reply = await pending;
  assert.equal(reply.type, 'error');
  assert.equal(reply.message, 'invalid json');
  ws.close();

  const reconnect = await open();
  assert.equal(reconnect.first.type, 'connected');
  reconnect.ws.close();
});
