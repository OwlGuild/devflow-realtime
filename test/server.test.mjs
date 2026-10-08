import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const STARTUP_DEADLINE_MS = 15000;

let child;
let port;
let output = '';

function open(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`no greeting within ${timeoutMs}ms\n${output}`));
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

async function connect() {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await open(Math.max(deadline - Date.now(), 1000));
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw lastError ?? new Error(`server never accepted a connection\n${output}`);
}

function next(ws, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no frame within ${timeoutMs}ms`)),
      timeoutMs,
    );
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
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
    const match = output.match(/listening on :(\d+)/);
    if (match && !port) {
      port = Number(match[1]);
    }
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.on('exit', (code, signal) => {
    output += `\nserver exited unexpectedly (code=${code}, signal=${signal})`;
  });

  const deadline = Date.now() + STARTUP_DEADLINE_MS;
  while (!port && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!port) {
    throw new Error(`server never announced a port\n${output}`);
  }
});

after(() => {
  if (child) child.kill();
});

test('greets a new connection', { timeout: 10000 }, async () => {
  const { ws, first } = await connect();
  assert.equal(first.type, 'connected');
  assert.equal(first.service, 'devflow-realtime');
  ws.close();
});

test('echoes a json message back', { timeout: 10000 }, async () => {
  const { ws } = await connect();
  const pending = next(ws);
  ws.send(JSON.stringify({ type: 'move', task: 42 }));
  const reply = await pending;
  assert.equal(reply.type, 'echo');
  assert.deepEqual(reply.received, { type: 'move', task: 42 });
  ws.close();
});

test('rejects invalid json and keeps serving the same socket', { timeout: 15000 }, async () => {
  const { ws } = await connect();
  const badPending = next(ws);
  ws.send('not json');
  const badReply = await badPending;
  assert.equal(badReply.type, 'error');
  assert.equal(badReply.message, 'invalid json');

  const goodPending = next(ws);
  ws.send(JSON.stringify({ type: 'move', task: 7 }));
  const goodReply = await goodPending;
  assert.equal(goodReply.type, 'echo');
  assert.deepEqual(goodReply.received, { type: 'move', task: 7 });
  ws.close();

  const reconnect = await connect();
  assert.equal(reconnect.first.type, 'connected');
  reconnect.ws.close();
});
