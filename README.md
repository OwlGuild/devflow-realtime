# devflow-realtime

WebSocket layer that pushes live updates for **DevFlow** — task moved, comment added, member
assigned — without anyone pressing refresh.

[![CI](https://github.com/OwlGuild/devflow-realtime/actions/workflows/ci.yml/badge.svg)](https://github.com/OwlGuild/devflow-realtime/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![WebSocket](https://img.shields.io/badge/transport-ws-0078d4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

**Live:** `wss://devflow-realtime.onrender.com`

## Why this exists

Polling wastes requests and still lags. Every open client should see the same board at roughly
the same time, and the connection should recover cleanly when it drops.

## What it does today

- Accepts connections and greets the client with a `connected` frame
- Echoes JSON frames back with a typed envelope (`echo`), so consumers never parse raw payloads
- Rejects malformed frames with an `error` frame instead of dropping the socket
- Caps frames at 1 MB, tracks errors per socket and heartbeats every 30s so half-open
  connections are terminated instead of lingering
- Shuts down cleanly on `SIGTERM`/`SIGINT` (what Render sends on redeploy)

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript, strict mode |
| Transport | `ws` |
| Tests | built-in `node:test` runner |

## Quickstart

```bash
git clone https://github.com/OwlGuild/devflow-realtime.git
cd devflow-realtime
npm install
npm run dev
```

Connects to `ws://localhost:8080`. Override with `PORT`.

## Protocol

```jsonc
// server → client
{ "type": "connected", "service": "devflow-realtime" }

// client → server
{ "type": "move", "task": 42 }

// server → client
{ "type": "echo", "received": { "type": "move", "task": 42 } }
{ "type": "error", "message": "invalid json" }
```

## Testing

```bash
npm run build
npm test
```

Three integration tests spawn the compiled server, open a real socket and assert the wire
behaviour end to end:

```bash
✔ greets a new connection
✔ echoes a json message back
✔ rejects invalid json and keeps serving new connections

ℹ tests 3
ℹ pass 3
ℹ fail 0
```

## Roadmap

- `subscribe` frames scoped to a workspace, with `last_seq` replay on reconnect
- Presence registry backed by Redis, so any instance can answer "who is here"
- Fan-out over Redis pub/sub for horizontal scaling
- Load test that drops every client mid-stream and asserts no sequence gaps

## Ownership

Both maintainers of [OwlGuild](https://github.com/OwlGuild) commit here.

| Area | Maintainer |
|---|---|
| Protocol design and event schema | [@AhmadGolbooee](https://github.com/AhmadGolbooee) |
| Server lifecycle and heartbeats | [@AhmadGolbooee](https://github.com/AhmadGolbooee) |
| Reconnect and resume logic (planned) | [@AhmadGolbooee](https://github.com/AhmadGolbooee) |
| Presence and fan-out with Redis (planned) | shared with [@MarziehAkrami](https://github.com/MarziehAkrami) |
| Emission points in the API (planned) | [@MarziehAkrami](https://github.com/MarziehAkrami) |
| CI, Docker, docs | shared |

## Related

- [`devflow-api`](https://github.com/OwlGuild/devflow-api) — produces the events
- [`devflow-web`](https://github.com/OwlGuild/devflow-web) — consumes them

## License

[MIT](LICENSE).
