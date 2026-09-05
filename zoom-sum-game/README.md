# Zoom Sum Game

A lightweight multiplayer browser game intended to be shared as an ordinary link in a Zoom meeting. It is **not** a Zoom App and uses no Zoom SDK, OAuth, Marketplace integration, or Collaborate Mode.

## Production URL

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/`

## Architecture

- `index.html` — the complete client: HTML, CSS, and JavaScript in one file.
- `../worker-src/index.js` — Cloudflare Worker API plus the `GameRoom` Durable Object.
- `../wrangler.jsonc` — Worker/static-assets/Durable Object configuration.
- Each six-character room code maps to one Durable Object by `idFromName(roomCode)`.
- WebSocket state is server-authoritative.
- The host secret is generated server-side and stored only in the host browser's `localStorage`.
- Player identity is a random browser-local ID in `localStorage`; reconnecting does not create a second player entry.
- Inactive rooms expire after 12 hours and are cleared by a Durable Object alarm.

## Protocol overview

Browser clients connect to:

`/zoom-sum-game/api/ws?room=ABC234&clientId=...&role=player`

The host additionally connects with `role=host&secret=...`. Host-only commands are rejected unless the WebSocket was authenticated with the room's host secret.

Player commands:

- `join`
- `select`
- `setReady`

Host commands:

- `startRound`
- `reveal`

The Durable Object broadcasts an individualized state snapshot after every state change. Hidden targets are omitted from participant snapshots until reveal.

## Development

With Node.js installed:

```sh
npm install
npm run dev
```

Deploy with:

```sh
npm run deploy
```
