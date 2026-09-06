# Zoom Sum Game

A lightweight multiplayer game for Zoom meetings.

The primary version is an ordinary browser game shared by URL. There is also an experimental Zoom App wrapper that embeds the same game client, so both variants use the same game logic and Cloudflare backend.

## Production URLs

Browser version:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/`

Zoom App wrapper:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/zoom.html`

## Current status — 2026-09-07

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
- live target editing controlled by the host;
- WebSocket synchronization and reconnect support;
- one Durable Object per room;
- inactive-room cleanup.

## Current game and UI rules

These rules are the current agreed behavior and should be preserved unless explicitly changed.

### 1. Single-screen UI

For both host and participant, on all supported devices and in both portrait and landscape orientation:

- the complete primary UI must fit into one viewport;
- the page itself must not require vertical scrolling;
- controls scale with viewport size;
- secondary lists may scroll internally if necessary;
- on the host screen the participant list is collapsed by default;
- the participant's main visual priorities are the target, the `0–5` choice buttons, Ready state, and the result;
- secondary information should remain visually subordinate.

This rule also applies to the shared client when embedded in the Zoom App wrapper.

### 2. Target is live room state

The target is not merely a parameter applied when a new round starts.

- any valid edit of the host's target input is sent to the server immediately;
- all connected clients receive the updated room state immediately;
- clearing the target field means that the target is **not set**;
- an empty target field must never be interpreted as `0`;
- starting a round requires a valid integer target.

The server remains authoritative for the current target.

### 3. `Show target` checkbox

The host control is named **`Показывать цель`** (`Show target`).

Its effect is immediate and independent of starting a new round.

Display rule for the current target:

- target not set → `—`;
- target set + `Show target` off → `?`;
- target set + `Show target` on → actual target number.

Changing the checkbox immediately updates all connected clients.

### 4. Host `Мой ход` block

The host may participate as an ordinary player while retaining host privileges.

In the host's **`Мой ход`** block:

- the large value is labeled **`Цель`**, not `Ваш выбор`;
- that value follows exactly the same visibility rule as the participant target display:
  - no target → `—`;
  - hidden target → `?`;
  - visible target → actual number;
- the host's own selected number is represented by the highlighted `0–5` button rather than by replacing the target display.

### 5. Current target vs finished-round target

These are distinct values conceptually:

- **current target** — the live value in the host input, which may be edited for the next round;
- **finished-round target** — the target captured in the completed round result.

Editing the current target after a round has finished must not alter the target stored in that finished result.

### 6. Target visibility in the result block

For a completed round, the result block shows the finished-round target according to this rule:

- if `sum === target`, the target is shown **always**, regardless of the `Show target` checkbox;
- if the sum does not match and `Show target` is on, show the finished-round target number;
- if the sum does not match and `Show target` is off, show `?`.

The sum itself is always shown.

Changing `Show target` after a failed round should immediately change the visibility of that finished-round target, while the stored finished-round target value itself remains unchanged.

### 7. Normal round mode

- each participant chooses one number from `0` to `5`;
- the participant presses `Готов`;
- before reveal, the participant may unready and change the number;
- the host sees readiness state;
- the host reveals the result when all active participants are ready;
- the server calculates the sum.

### 8. Countdown round mode

When **`Обратный отсчёт`** is enabled:

- all clients show `3 → 2 → 1 → СТАРТ`;
- after `СТАРТ`, each round participant has exactly one accepted choice from `0` to `5`;
- the first accepted choice is locked and cannot be changed;
- the round participant set is fixed when the countdown round begins;
- users joining after the countdown begins wait for the next round;
- when all round participants have chosen, the Durable Object waits two seconds and reveals automatically;
- automatic reveal does not depend on the host browser remaining active.

### 9. Host participation

- the host may join the player set under a name;
- the host's player choice is included in the sum exactly once;
- host authorization remains separate from player identity;
- being a player does not weaken host-only permissions such as starting rounds, changing target visibility, changing the live target, or revealing a normal round.

### 10. Reconnection and identity

- the browser stores a stable player `clientId` in `localStorage`;
- reconnecting with the same identity must not create a duplicate player in the sum;
- name, role and round state should be restored where possible after a short connection loss;
- Ready/choice synchronization should tolerate brief WebSocket interruptions.

## Zoom App wrapper

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
- further automatic Zoom room association has not yet been implemented.

**Development checkpoint:** leave the Zoom-specific integration at this point. Current priority is correction and simplification of the shared UI.

## Architecture

- `index.html` — complete shared game client: HTML, CSS and JavaScript in one file.
- `zoom.html` — thin Zoom App wrapper around the shared client.
- `../worker-src/index.js` — base Cloudflare Worker API and base `GameRoom` Durable Object.
- `../worker-src/target-visibility.js` — live target-visibility and single-viewport UI layer.
- `../worker-src/ui.js` — current Worker entry point; live target editing and current UI behavior overrides.
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
- `setTarget`

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
