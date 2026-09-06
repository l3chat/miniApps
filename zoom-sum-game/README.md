# Zoom Sum Game

A lightweight multiplayer game for Zoom meetings.

The primary version is an ordinary browser game shared by URL. There is also an experimental Zoom App wrapper that embeds the same game client, so both variants use the same game logic and Cloudflare backend.

## Production URLs

Browser version:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/`

Zoom App wrapper:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/zoom.html`

## Current status — 2026-09-06

### Browser version

Working MVP tested with a host on a tablet, another player in a second browser on the same tablet, and a player on a smartphone.

Implemented:

- short room codes and participant links;
- host secret and browser-local player identity;
- names and choices 0–5;
- normal mode with Ready / Unready;
- host can also participate as a player;
- countdown mode: `3 → 2 → 1 → START`;
- in countdown mode each player gets one locked choice;
- automatic reveal two seconds after all round participants choose;
- target, sum and individual choices on reveal;
- live target visibility controlled by the host;
- target display semantics: no target = `—`, hidden target = `?`, visible target = the number;
- WebSocket synchronization and reconnect support;
- one Durable Object per room;
- inactive-room cleanup.

### Zoom App wrapper

Status: **prototype exists; further Zoom-specific work is paused while the common game UI is being refined.**

Implemented:

- `zoom.html` loads the Zoom Apps SDK;
- initializes as a Zoom App;
- provides the standard Zoom invitation dialog;
- embeds the common `index.html` game client;
- uses the same Cloudflare Worker, WebSocket protocol and Durable Objects as the browser version;
- common UI/game changes therefore automatically affect both browser and Zoom variants.

Current limitation / next Zoom-specific step:

- the Zoom wrapper does not yet automatically transfer the current game-room code to invited participants;
- invited users may need to enter the short room code manually;
- Collaborate Mode / automatic room association has not been pursued in this branch yet.

**Development checkpoint:** leave the Zoom-specific integration at this point. Current priority is correction and simplification of the shared UI in `index.html`.

## Architecture

- `index.html` — complete shared game client: HTML, CSS and JavaScript in one file.
- `zoom.html` — thin Zoom App wrapper around the shared client.
- `../worker-src/index.js` — base Cloudflare Worker API and `GameRoom` Durable Object.
- `../worker-src/target-visibility.js` — current Worker entry point adding live target-visibility control.
- `../wrangler.jsonc` — Worker/static-assets/Durable Object configuration.
- Each six-character room code maps to one Durable Object by `idFromName(roomCode)`.
- WebSocket state is server-authoritative.
- The host secret is generated server-side and stored only in the host browser's `localStorage`.
- Player identity is a random browser-local ID in `localStorage`; reconnecting does not create a second player entry.
- Inactive rooms expire after 12 hours.

## Protocol overview

Browser clients connect to:

`/zoom-sum-game/api/ws?room=ABC234&clientId=...&role=player`

The host additionally connects with `role=host&secret=...`. Host-only commands are rejected unless the WebSocket was authenticated with the room's host secret.

Important commands currently include:

Player / shared:

- `join`
- `select`
- `setReady`

Host:

- `startRound`
- `reveal`
- `setTargetVisible`

The Durable Object broadcasts individualized state snapshots after state changes.

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
