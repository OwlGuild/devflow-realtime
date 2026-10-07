# devflow-realtime

WebSocket layer that pushes live updates for **DevFlow** — task moved, comment added, member
assigned — without anyone pressing refresh.

[![CI](https://github.com/OwlGuild/devflow-realtime/actions/workflows/ci.yml/badge.svg)](https://github.com/OwlGuild/devflow-realtime/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![WebSocket](https://img.shields.io/badge/transport-ws-0078d4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

## Why this exists

Polling wastes requests and still lags. DevFlow needs every open client to see the same board
at roughly the same time, and it needs to keep working when a connection drops.

## What it guarantees

- **At-least-once delivery with idempotent handlers** — a duplicated event cannot double-count
- **Resume after disconnect** — the client replays events from its last known sequence number
- **Scoped subscriptions** — a client only receives events for workspaces it belongs to
- **Backpressure awareness** — slow consumers are dropped from the fan-out rather than queued

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript, strict mode |
| Transport | `ws` behind a small abstraction |
| Presence | Redis for connection registries |
| Fan-out | Redis pub/sub |
| Contract | shared event types with `devflow-api` |

## Quickstart

```bash
git clone https://github.com/OwlGuild/devflow-realtime.git
cd devflow-realtime
cp .env.example .env
docker compose up --build
pnpm dev
```

Connects to `ws://localhost:8080`.

## Protocol

```jsonc
// client → server
{ "type": "subscribe", "workspace": "ws_123", "last_seq": 4820 }
{ "type": "ping" }

// server → client
{ "type": "event", "seq": 4821, "name": "task.moved", "payload": { ... } }
{ "type": "resume_ok", "replayed": 3 }
{ "type": "error", "code": "not_authorized" }
```

Event names and payload shapes are declared once in `src/protocol/` and re-exported so the API
and the web client cannot drift apart.

## Testing

```bash
pnpm test        # unit
pnpm test:load   # connection storm: 1000 clients, reconnect and resume
```

The load test is the interesting one: it disconnects every client mid-stream and asserts that
each one resumes with no missing sequence numbers.

## Ownership

Both maintainers of [OwlGuild](https://github.com/OwlGuild) commit here.

| Area | Maintainer |
|---|---|
| Protocol design and event schema | [@AhmadGolbooee](https://github.com/AhmadGolbooee) |
| Reconnect and resume logic | [@AhmadGolbooee](https://github.com/AhmadGolbooee) |
| Presence and fan-out with Redis | shared with [@MarziehAkrami](https://github.com/MarziehAkrami) |
| Emission points in the API | [@MarziehAkrami](https://github.com/MarziehAkrami) |
| CI, Docker, docs | shared |

## Related

- [`devflow-api`](https://github.com/OwlGuild/devflow-api) — produces the events
- [`devflow-web`](https://github.com/OwlGuild/devflow-web) — consumes them

## License

[MIT](LICENSE).
