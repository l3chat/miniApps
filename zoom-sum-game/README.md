# Zoom Sum Game

A lightweight multiplayer game for Zoom meetings.

The project has two front ends over the same Cloudflare backend:

- a normal browser version that can be opened from any browser;
- a Zoom App wrapper that embeds the same game client inside Zoom.

Both variants share the same game logic, WebSocket protocol, Durable Objects and room state.

## Production URLs

Browser version:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/`

Zoom App wrapper:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/zoom.html`

Zoom OAuth start:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/oauth/start`

Zoom OAuth redirect / callback:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/oauth/callback`

## Current status — 2026-09-09

The project is now a working multiplayer Zoom game rather than only a prototype.

Verified scenarios include:

- host on an Android tablet;
- additional participant in another browser on the same tablet;
- participant on a smartphone;
- Zoom App running inside Zoom on Android;
- Zoom App running on desktop Zoom;
- OAuth authorization for the user-managed Zoom App;
- in-meeting sharing through Zoom's built-in paper-plane / Send control;
- automatic transfer of the current game room to invited Zoom participants;
- automatic transfer of the participant's Zoom display name;
- automatic entry into the game for invited Zoom participants without pressing an extra Enter button.

## Game rules

- The host creates a room.
- The room receives a short six-character code.
- The host enters an integer target value.
- The host can show or hide the target immediately using `Show target`.
- Every participant chooses one number from `0` to `5`.
- In normal mode the participant confirms with Ready and may unready before reveal.
- In countdown mode the application displays `3 → 2 → 1 → START`; after START each participant gets one locked choice.
- The server computes the sum.
- On reveal everyone sees the sum and individual participant values.
- The target is always revealed on a successful match; on a failed round it follows the current Show target setting.
- The host can also participate as a normal player.

## Current target rules

The target is live room state, not only a parameter copied when a round starts.

- Editing the host target field immediately updates server state.
- Clearing the field means that no target is set.
- Empty target must never become zero implicitly.
- Starting a round requires a valid integer target.

Display rule:

- no target → `—`;
- target exists + Show target off → `?`;
- target exists + Show target on → the actual value.

The same rule applies to:

- participant target display;
- host `My turn` target display;
- a failed finished round.

A successful finished round always reveals its target.

## Normal mode

- participant selects `0–5`;
- participant presses Ready;
- participant may unready and change the number before reveal;
- host sees readiness state;
- host reveals when all active participants are ready;
- server computes the result.

## Countdown mode

When countdown mode is enabled:

- all clients show `3 → 2 → 1 → START`;
- participants that were present when the round started are fixed as the round participant set;
- users joining after the countdown starts wait for the next round;
- after START, the first accepted choice is locked;
- when all round participants have chosen, the Durable Object waits two seconds;
- the result is then revealed automatically;
- automatic reveal does not depend on the host browser remaining active.

## Single-screen UI

For both host and participant:

- the main interface should fit in one viewport;
- the page itself should not require vertical scrolling;
- controls scale with viewport size;
- secondary lists may scroll internally;
- the participant's main visual priorities are target, number choice, Ready state and result;
- the host participant list is collapsed by default;
- the same layout rules apply when embedded inside Zoom.

## Multilingual UI

The game client is multilingual.

Currently supported languages:

- English;
- Deutsch;
- Русский;
- Українська.

Language behavior:

- the client first uses a language saved in `localStorage`;
- otherwise it selects from the browser / Zoom WebView language;
- unsupported languages fall back to English;
- a compact language selector in the header allows manual switching;
- the selected language is stored locally;
- game state is language-neutral, so different participants may use different interface languages in the same room.

Localization covers static controls, connection status, countdown text, participant hints, result labels and the common server error messages.

Localization commit:

- `b21172054f1e58b677fb2101f71ea3a673049a5d` — add English, German, Russian and Ukrainian UI.

## Browser version

The browser version remains fully independent of Zoom.

It supports:

- room creation;
- joining by room code or participant link;
- local participant identity through `localStorage`;
- reconnect support;
- host participation;
- normal and countdown modes;
- live target visibility;
- multilingual UI.

This remains the fallback for platforms where the Zoom App is unavailable or intentionally unsupported.

## Zoom App

`zoom.html` is intentionally a thin wrapper around `index.html`.

It performs Zoom-specific integration and leaves the actual game UI in the common browser client.

### Invitation / Send behavior

The application no longer implements its own Invite button.

On desktop and Android Zoom, the host uses Zoom's built-in **Send / paper-plane** control for the current Zoom App. Zoom itself creates and displays the invitation.

The exact location and presentation of that invitation are controlled by Zoom, not by this application. In the tested Android flow the invitation appears in meeting chat and can be opened by participants.

### Automatic room association

The game room is associated with the current Zoom meeting using the Meeting UUID.

Flow:

1. The host opens the Zoom App.
2. The host creates a normal game room.
3. `zoom.html` detects the new room and its host secret.
4. The Cloudflare Worker verifies host ownership.
5. The Worker stores a short-lived `Meeting UUID → room code` association.
6. The host uses Zoom's built-in Send control.
7. An invited participant opens the Zoom App.
8. `zoom.html` gets the same Meeting UUID and looks up the associated room.
9. The shared `index.html` is opened directly with that room code.

The host secret is never returned to invited participants.

Meeting-room associations expire automatically after approximately 12 hours.

Relevant commits:

- `515f137143782fbd629b02234ad68ed32ac67c02` — add server-side Zoom meeting → room association;
- `e27a7022c39038b7e9bbd8e99f03c6d3159d518c` — obtain Zoom meeting/user context in the wrapper;
- `bbabdf689d430bb1f76a310ec004a8a2ebe5f22d` — pass Zoom user name to the shared client;
- `83ca3f32314eee002dbe0eb2943caf2af6230980` — automatically enter invited Zoom participants into the game.

### Automatic participant name

The Zoom wrapper uses `getUserContext()` and takes the participant's Zoom display name (`screenName`).

That name is stored in the shared game's existing local name key and is used for the game participant record.

For an invited participant with a linked room:

- room code is supplied automatically;
- Zoom display name is supplied automatically;
- the participant is joined automatically;
- no extra `Enter game` click is required in the normal Zoom flow.

The ordinary browser version still keeps the manual name-entry workflow.

### Zoom SDK APIs currently used

The Zoom wrapper currently relies on:

- `getRunningContext`;
- `getUserContext`;
- `getMeetingUUID`.

The earlier custom invitation SDK approach was removed because the tested Android client did not expose the invitation APIs through `getSupportedJsApis()`. Zoom's own Send control is simpler and works on both tested desktop and Android clients.

## Zoom OAuth

The Zoom App is configured as a user-managed app with a minimal OAuth flow.

Implemented endpoints:

- `/zoom-sum-game/oauth/start` — starts authorization and creates a CSRF state cookie;
- `/zoom-sum-game/oauth/callback` — receives the authorization code and exchanges it at Zoom's token endpoint;
- `/zoom-sum-game/api/version` — reports Worker build information and whether OAuth credentials are present.

OAuth has been successfully tested in production.

The tested authorization completed with the scope:

`zoomapp:inmeeting`

The current design deliberately does not persist access or refresh tokens because the multiplayer game itself does not call Zoom REST APIs.

Required Cloudflare secrets:

- `ZOOM_CLIENT_ID`;
- `ZOOM_CLIENT_SECRET`.

Optional variable:

- `ZOOM_REDIRECT_URI`.

Production redirect URL:

`https://miniapps.lechat-reg.workers.dev/zoom-sum-game/oauth/callback`

Relevant OAuth commit:

- `2c4c7810b188f0a71a709870ec3a82868d97e878` — add minimal Zoom OAuth endpoints.

## Architecture

### Client

`zoom-sum-game/index.html`

- authoritative game UI;
- HTML, CSS and JavaScript in one autonomous page;
- WebSocket client;
- game rendering;
- responsive single-screen layout;
- localization.

`zoom-sum-game/zoom.html`

- thin Zoom Apps SDK wrapper;
- gets Zoom user context and Meeting UUID;
- resolves the game room for the current Zoom meeting;
- supplies Zoom participant name;
- performs automatic participant entry;
- contains no separate game implementation.

### Server

`worker-src/index.js`

- base API;
- room creation;
- WebSocket routing;
- base `GameRoom` Durable Object;
- normal and countdown game mechanics.

`worker-src/ui.js`

- current Worker entry point;
- live target / target visibility rules;
- Zoom OAuth routes;
- Zoom Meeting UUID → game-room association;
- delegates static assets to Cloudflare;
- does **not** rewrite game HTML.

`wrangler.jsonc`

- Worker configuration;
- static assets;
- Durable Object binding;
- deployment settings.

Important architectural rule: ordinary client UI changes belong in `index.html`. Do not reintroduce Worker-side HTML string replacements.

## Durable Objects and identity

Each six-character game room maps to one Durable Object using `idFromName(roomCode)`.

The server is authoritative for game state.

Player identity:

- a random stable `clientId` is stored in browser `localStorage`;
- reconnecting with the same browser identity does not create a duplicate player in the sum.

Host identity:

- the host receives a random server-generated secret;
- the secret is stored only in the host browser;
- host-only WebSocket operations require that secret;
- the Zoom meeting-room binding endpoint verifies the same host secret before associating a room with a meeting.

No personal data is intentionally stored beyond the participant-entered / Zoom-provided display name required for the current game room.

## Protocol overview

Browser clients connect to:

`/zoom-sum-game/api/ws?room=ABC234&clientId=...&role=player`

The host additionally supplies:

`role=host&secret=...`

Important WebSocket commands:

Participant/shared:

- `join`;
- `select`;
- `setReady`.

Host:

- `startRound`;
- `reveal`;
- `setTargetVisible`;
- `setTarget`.

Zoom meeting-room helper endpoint:

`/zoom-sum-game/api/zoom-meeting-room`

- `GET` with Meeting UUID → returns the associated room code, if any;
- `POST` with Meeting UUID, room code and host secret → creates the association after host verification.

## Reconnection

- WebSocket reconnect uses exponential backoff;
- the browser keeps a stable client ID;
- queued join / select / Ready commands may survive a short connection interruption;
- participant state is restored from the server where possible;
- a player must not be counted twice after reconnecting.

## Mobile optimization checkpoint

An iPhone participant reported noticeable heating during play.

An initial optimization attempt changed multiple things at once and caused a regression. Investigation also revealed that older UI changes were being applied through Worker-side HTML replacements, which could be bypassed by direct static asset delivery.

The architecture was corrected so that the complete client now lives directly in `index.html`.

Optimization policy from this point onward:

- make one isolated optimization at a time;
- functionally test it before applying the next one.

The first low-risk optimization removed the full-screen `backdrop-filter: blur(10px)` from the countdown overlay while leaving countdown timing unchanged.

Commit:

- `41497c15b81f7e9408059f936a99c61a950d9a00`.

The countdown timer interval remains at the known-working `80 ms` until a later isolated optimization is tested.

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
