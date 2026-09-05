import { DurableObject } from "cloudflare:workers";

const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_PLAYERS = 64;
const MAX_NAME_LENGTH = 40;
const MAX_MESSAGE_BYTES = 8192;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function randomRoomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
  return code;
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeRoomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return ROOM_CODE_RE.test(code) ? code : null;
}

function cleanName(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
}

function isSafeTarget(value) {
  return Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000_000;
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/zoom-sum-game/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (!sameOrigin(request)) {
      return json({ error: 'Cross-origin request rejected' }, { status: 403 });
    }

    if (url.pathname === '/zoom-sum-game/api/create' && request.method === 'POST') {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const room = randomRoomCode();
        const hostSecret = randomSecret();
        const id = env.GAME_ROOMS.idFromName(room);
        const stub = env.GAME_ROOMS.get(id);
        const response = await stub.fetch('https://room.internal/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ room, hostSecret }),
        });
        if (response.status === 201) return json({ room, hostSecret }, { status: 201 });
        if (response.status !== 409) return json({ error: 'Could not create room' }, { status: 500 });
      }
      return json({ error: 'Could not allocate a room code' }, { status: 503 });
    }

    if (url.pathname === '/zoom-sum-game/api/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return json({ error: 'WebSocket upgrade required' }, { status: 426 });
      }

      const room = normalizeRoomCode(url.searchParams.get('room'));
      const clientId = String(url.searchParams.get('clientId') || '').trim();
      const requestedRole = url.searchParams.get('role') === 'host' ? 'host' : 'player';
      const hostSecret = String(url.searchParams.get('secret') || '');

      if (!room || !clientId || clientId.length > 128) {
        return json({ error: 'Invalid room or client id' }, { status: 400 });
      }

      const id = env.GAME_ROOMS.idFromName(room);
      const stub = env.GAME_ROOMS.get(id);
      const doUrl = new URL('https://room.internal/websocket');
      doUrl.searchParams.set('clientId', clientId);
      doUrl.searchParams.set('role', requestedRole);
      if (requestedRole === 'host') doUrl.searchParams.set('secret', hostSecret);
      return stub.fetch(new Request(doUrl, request));
    }

    return json({ error: 'Not found' }, { status: 404 });
  },
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.room = undefined;
    this.loading = this.ctx.storage.get('room').then((room) => {
      this.room = room || null;
    });
  }

  async ensureLoaded() {
    await this.loading;
  }

  async fetch(request) {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (url.pathname === '/create' && request.method === 'POST') {
      if (this.room) return new Response('exists', { status: 409 });
      const body = await request.json();
      const roomCode = normalizeRoomCode(body.room);
      const hostSecret = String(body.hostSecret || '');
      if (!roomCode || hostSecret.length < 32) return new Response('bad request', { status: 400 });

      const now = Date.now();
      this.room = {
        code: roomCode,
        hostSecret,
        phase: 'setup',
        round: 0,
        target: null,
        targetVisible: false,
        result: null,
        players: {},
        createdAt: now,
        lastActivity: now,
      };
      await this.persist();
      return new Response('created', { status: 201 });
    }

    if (url.pathname === '/websocket') {
      if (!this.room) return new Response('Room not found', { status: 404 });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 426 });
      }

      const clientId = String(url.searchParams.get('clientId') || '').trim();
      const requestedRole = url.searchParams.get('role') === 'host' ? 'host' : 'player';
      const suppliedSecret = String(url.searchParams.get('secret') || '');
      if (!clientId || clientId.length > 128) return new Response('Invalid client id', { status: 400 });

      if (requestedRole === 'host' && suppliedSecret !== this.room.hostSecret) {
        return new Response('Invalid host secret', { status: 403 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const attachment = { clientId, role: requestedRole };
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);
      await this.touch();
      this.sendSnapshot(server);
      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  getAttachment(ws) {
    try {
      return ws.deserializeAttachment() || {};
    } catch {
      return {};
    }
  }

  getActivePlayerIds() {
    const ids = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const attachment = this.getAttachment(ws);
      if (attachment.clientId && this.room?.players?.[attachment.clientId]) {
        ids.add(attachment.clientId);
      }
    }
    return ids;
  }

  getActivePlayers() {
    const activeIds = this.getActivePlayerIds();
    return Object.entries(this.room.players)
      .filter(([clientId]) => activeIds.has(clientId))
      .map(([clientId, player]) => ({ clientId, ...player }));
  }

  publicStateFor(attachment) {
    const isHost = attachment.role === 'host';
    const me = this.room.players[attachment.clientId] || null;
    const activePlayers = this.getActivePlayers();

    const base = {
      type: 'state',
      room: this.room.code,
      phase: this.room.phase,
      round: this.room.round,
      targetVisible: this.room.targetVisible,
      target: null,
      players: activePlayers.map((player) => ({
        clientId: player.clientId,
        name: player.name,
        ready: Boolean(player.ready),
      })),
      allReady: activePlayers.length > 0 && activePlayers.every((player) => player.ready),
      me: me ? { name: me.name, value: me.value, ready: Boolean(me.ready) } : null,
      result: this.room.result,
    };

    if (this.room.phase === 'choosing' && (isHost || this.room.targetVisible)) {
      base.target = this.room.target;
    }
    if (this.room.phase === 'reveal' && this.room.result) {
      base.target = this.room.result.target;
    }
    return base;
  }

  send(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {}
  }

  sendSnapshot(ws) {
    if (this.room) this.send(ws, this.publicStateFor(this.getAttachment(ws)));
  }

  broadcast() {
    if (!this.room) return;
    for (const ws of this.ctx.getWebSockets()) this.sendSnapshot(ws);
  }

  sendError(ws, message) {
    this.send(ws, { type: 'error', message });
  }

  async webSocketMessage(ws, message) {
    await this.ensureLoaded();
    if (!this.room) return;

    if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > MAX_MESSAGE_BYTES) {
      this.sendError(ws, 'Invalid message');
      return;
    }

    let data;
    try {
      data = JSON.parse(message);
    } catch {
      this.sendError(ws, 'Invalid JSON');
      return;
    }

    const attachment = this.getAttachment(ws);
    const isHost = attachment.role === 'host';
    const clientId = attachment.clientId;

    if (data.type === 'ping') {
      this.send(ws, { type: 'pong', now: Date.now() });
      return;
    }

    if (isHost && data.type === 'startRound') {
      const target = Number(data.target);
      if (!isSafeTarget(target)) {
        this.sendError(ws, 'Target must be an integer between -1000000000 and 1000000000');
        return;
      }
      this.room.round += 1;
      this.room.phase = 'choosing';
      this.room.target = target;
      this.room.targetVisible = Boolean(data.targetVisible);
      this.room.result = null;
      for (const player of Object.values(this.room.players)) {
        player.value = null;
        player.ready = false;
      }
      await this.persist();
      this.broadcast();
      return;
    }

    if (isHost && data.type === 'reveal') {
      if (this.room.phase !== 'choosing') {
        this.sendError(ws, 'No active round');
        return;
      }
      const activePlayers = this.getActivePlayers();
      if (activePlayers.length === 0 || !activePlayers.every((player) => player.ready && Number.isInteger(player.value))) {
        this.sendError(ws, 'All active players must be ready');
        return;
      }
      const entries = activePlayers.map((player) => ({
        clientId: player.clientId,
        name: player.name,
        value: player.value,
      }));
      const sum = entries.reduce((total, player) => total + player.value, 0);
      this.room.result = {
        target: this.room.target,
        sum,
        success: sum === this.room.target,
        players: entries,
        revealedAt: Date.now(),
      };
      this.room.phase = 'reveal';
      await this.persist();
      this.broadcast();
      return;
    }

    if (!clientId) {
      this.sendError(ws, 'Missing client id');
      return;
    }

    if (data.type === 'join') {
      const name = cleanName(data.name);
      if (!name) {
        this.sendError(ws, 'Enter a name');
        return;
      }
      let player = this.room.players[clientId];
      if (!player) {
        if (Object.keys(this.room.players).length >= MAX_PLAYERS) {
          this.sendError(ws, 'Room is full');
          return;
        }
        player = { name, value: null, ready: false, joinedAt: Date.now() };
        this.room.players[clientId] = player;
      } else {
        player.name = name;
      }
      await this.persist();
      this.broadcast();
      return;
    }

    const player = this.room.players[clientId];
    if (!player) {
      this.sendError(ws, isHost ? 'Join as a player first' : 'Enter your name first');
      return;
    }

    if (data.type === 'select') {
      if (this.room.phase !== 'choosing') {
        this.sendError(ws, 'No active round');
        return;
      }
      if (player.ready) {
        this.sendError(ws, 'Unready before changing your number');
        return;
      }
      const value = Number(data.value);
      if (!Number.isInteger(value) || value < 0 || value > 5) {
        this.sendError(ws, 'Choose a number from 0 to 5');
        return;
      }
      player.value = value;
      await this.persist();
      this.broadcast();
      return;
    }

    if (data.type === 'setReady') {
      if (this.room.phase !== 'choosing') {
        this.sendError(ws, 'No active round');
        return;
      }
      const ready = Boolean(data.ready);
      if (ready && !Number.isInteger(player.value)) {
        this.sendError(ws, 'Choose a number first');
        return;
      }
      player.ready = ready;
      await this.persist();
      this.broadcast();
      return;
    }

    if (!isHost && (data.type === 'startRound' || data.type === 'reveal')) {
      this.sendError(ws, 'Host permission required');
      return;
    }

    this.sendError(ws, 'Unknown command');
  }

  async webSocketClose(ws, code, reason) {
    await this.ensureLoaded();
    if (!this.room) return;
    await this.touch();
    this.broadcast();
    try {
      ws.close(code, reason);
    } catch {}
  }

  async webSocketError() {
    await this.ensureLoaded();
    if (this.room) this.broadcast();
  }

  async touch() {
    if (!this.room) return;
    this.room.lastActivity = Date.now();
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(this.room.lastActivity + ROOM_TTL_MS);
  }

  async persist() {
    if (!this.room) return;
    this.room.lastActivity = Date.now();
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(this.room.lastActivity + ROOM_TTL_MS);
  }

  async alarm() {
    await this.ensureLoaded();
    if (!this.room) return;
    const age = Date.now() - this.room.lastActivity;
    if (age < ROOM_TTL_MS) {
      await this.ctx.storage.setAlarm(this.room.lastActivity + ROOM_TTL_MS);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1001, 'Room expired');
      } catch {}
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }
}
