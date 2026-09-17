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

## Current status — 2026-09-17

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
- Every round displays `3 → 2 → 1 → START`; after START each participant gets one locked choice.
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

## Round flow

Countdown is the only game mode:

- all clients show `3 → 2 → 1 → START`;
- participants that were present when the round started are fixed as the round participant set;
- users joining after the countdown starts see the current round number, target according to its visibility setting, and the current participant roster, but wait for the next round before choosing;
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
- the participant's main visual priorities are target, number choice, current participant state and result;
- participant lists are expanded by default and use an internal scrollbar when needed;
- host-only controls have a purple theme, while the host's optional player area has a teal theme;
- the same layout rules apply when embedded inside Zoom.

## Multilingual UI

The game client is multilingual.

Currently supported languages:

- English;
- Deutsch;
- Français;
- Ελληνικά;
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
- countdown rounds;
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
- countdown game mechanics.

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
- `select`.

Host:

- `startRound`;
- `setTargetVisible`;
- `setTarget`.

`setReady` and manual `reveal` remain server-side only for compatibility with a room that was already running an older normal-mode round during deployment. Every newly started round is forced into countdown mode by the server, including requests from an older open client.

Zoom meeting-room helper endpoint:

`/zoom-sum-game/api/zoom-meeting-room`

- `GET` with Meeting UUID → returns the associated room code, if any;
- `POST` with Meeting UUID, room code and host secret → creates the association after host verification.

## Reconnection

- WebSocket reconnect uses exponential backoff;
- the browser keeps a stable client ID plus a private room-specific resume token;
- only a name/join request may wait for a short interruption; game actions are never replayed offline;
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

## Reliability fixes — 2026-09-14

Work is tracked by the audit IDs below; publication uses the existing Cloudflare Workers Builds integration.

- NET-1, NET-2, NET-3: round-bound game commands, authoritative recovery of pending countdown choices, and silent-connection watchdog.
- UI-2, UI-3: restore countdown form state and translate the connection label immediately.
- Regression tests: `npm run test:zoom-sum` (Node.js 22 or newer). The adapters simulate platform services; these are logic tests, not real Zoom/device tests.

Offline game commands are no longer replayed. Only a pending name/join request is sent after the first server snapshot. Old open pages must reload: roundless mutations receive an explicit update-required error.

- SEC-1, TARGET-1: no hidden failed target in any player-visible field; an unset result target has a neutral status and displays `—`.
- SEC-2: a private, server-issued resume token authenticates each player connection; the public player ID is not a credential. Tokens are never included in player lists/results or invitation links.
- INPUT-1: object/size validation applies before either Worker message handler; numeric/boolean commands reject coercion.
- ROOM-1, ROUND-1: 64 active players, at most 256 retained identities (12-hour retention); active countdown roster members are protected from pruning. Disconnected roster members stay in the round and are labelled offline.
- UI-1: short narrow viewports retain the single-column host layout; reduced host/result sizes and wrapping prevent the previous minimum-width clipping.

Migration: old open pages must reload once. Legacy player records without a resume token cannot be safely claimed by public ID; those players re-enter under a new room-specific ID. For a countdown already in progress at deployment, the host should start a new round after everyone reloads. Normal authenticated reconnection preserves the same player and accepted choice.


- ZOOM-1: replacing a meeting association verifies both the new room owner and the previous room owner; an atomic compare prevents stale overwrites. Permanent failures stop retries; transient failures have bounded backoff.
- ZOOM-2: a participant who arrives before the room is linked gets up to eight lookup attempts. Network/foreground events restart lookup. Manual Exit leaves the landing page available, including for creating a replacement room.
- ZOOM-3: context errors retry; context changes reconfigure the SDK. Optional event capabilities fall back to the original capability set on older/limited clients. A 30-second context check also detects changes when events are unavailable. Participants already in a room are not silently moved to another meeting.
- ZOOM-4: the same-origin wrapper asks the client for its actual role and uses an explicit participant-entry method. It never clicks hidden controls or automatically joins a restored host.
- OAUTH-1: callback requires matching state and cookie before code exchange. A Marketplace callback without either starts a fresh authorization flow with state; it does not exchange the uncorrelated code. Tokens remain unpersisted.

SDK behavior follows the current [Zoom Apps SDK reference](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html), including reconfiguration after context/role changes. OAuth uses Zoom’s [authorization-code flow](https://developers.zoom.us/docs/integrations/oauth/).

### Validation and deployment

All 17 audit groups are covered by the changes above. The original audit had 21 executable scenarios, not 21 independent bug groups. The regression suite checks accepted/lost selections, stale commands, countdown rounds, participant authentication, capacity/retention, meeting replacement races, context recovery and OAuth state.

UI-1 was checked by inspecting the responsive rules: short screens no longer force a two-column minimum width of 465 px. The countdown interval remains 80 ms, and pings remain at a 20-second cadence. The host result hides inactive participation controls to reserve space for the result and next-round settings; the page itself does not scroll. Participant lists and constrained settings may scroll internally.

Real-device/Zoom smoke testing was not available in the implementation environment. Remaining verification on actual devices: 320/360/390 px portrait, landscape, host result and open keyboard; Zoom Share App on Android/desktop; first-time Marketplace authorization. The automated adapters do not claim to verify visual layout, native Zoom permissions, or real OAuth consent.

Reliability release build identifier: `2026-09-14-reliability-v2`. Existing main-branch Cloudflare Workers Builds publishes releases. No changes are required to the configured OAuth callback, scope, client secrets, Wrangler bindings, or other miniApps.

## Interface update — 2026-09-17

Build identifier: `2026-09-17-countdown-ui-v1`.

- copied-link confirmation now closes automatically after 2.5 seconds;
- French and Greek were added, bringing the interface to six languages;
- participant lists are open by default for both host and participants and scroll internally when long;
- the participant roster, round number and permitted target information remain visible while waiting and to users who joined during an active round;
- successful results use a shorter, more emotional localized message (`Есть!` in Russian);
- normal mode was removed from the interface and all new rounds are server-enforced countdown rounds;
- host-only controls and the host's optional player area use different color themes;
- the countdown animation interval remains unchanged at 80 ms.

The regression suite now contains 36 passing scenarios. The six new checks cover the temporary copy notification, localization-key parity, the Russian success message, expanded/scrollable rosters, waiting/late participant information, and the distinct host color themes. Real-device layout and Zoom smoke tests remain a separate manual verification step.
