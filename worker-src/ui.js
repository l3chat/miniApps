import baseWorker, { GameRoom as BaseGameRoom } from './index.js';

const BUILD = '2026-09-08-zoom-context-v1';
const OAUTH_COOKIE = 'zoom_sum_oauth_state';
const OAUTH_MAX_AGE = 10 * 60;
const MEETING_LINK_TTL_MS = 12 * 60 * 60 * 1000;
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function htmlPage(title, body, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  const safeTitle = escapeHtml(title);
  return new Response(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:44rem;margin:4rem auto;padding:0 1.2rem;line-height:1.5}h1{font-size:1.5rem}code{word-break:break-all}.ok{color:#16833b}.err{color:#b42318}</style></head><body>${body}</body></html>`, { status, headers });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

function normalizeRoom(value) {
  const room = String(value || '').trim().toUpperCase();
  return ROOM_CODE_RE.test(room) ? room : null;
}

function normalizeMeetingUUID(value) {
  const meetingUUID = String(value || '').trim();
  if (!meetingUUID || meetingUUID.length > 512 || /[\u0000-\u001f\u007f]/.test(meetingUUID)) return null;
  return meetingUUID;
}

function roomStub(env, room) {
  return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room));
}

function meetingLinkStub(env, meetingUUID) {
  return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`zoom-meeting:${meetingUUID}`));
}

async function lookupMeetingRoom(env, meetingUUID) {
  const response = await meetingLinkStub(env, meetingUUID).fetch('https://room.internal/meeting-link');
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Meeting room lookup failed');
  const data = await response.json();
  return normalizeRoom(data.room);
}

async function bindMeetingRoom(env, meetingUUID, room, hostSecret) {
  const verify = await roomStub(env, room).fetch('https://room.internal/verify-host', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostSecret }),
  });
  if (verify.status === 404) return { status: 404, error: 'Room not found' };
  if (verify.status !== 204) return { status: 403, error: 'Host permission required' };

  const response = await meetingLinkStub(env, meetingUUID).fetch('https://room.internal/meeting-link', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room, expiresAt: Date.now() + MEETING_LINK_TTL_MS }),
  });

  if (response.status === 409) return { status: 409, error: 'This Zoom meeting is already linked to another room' };
  if (!response.ok) return { status: 500, error: 'Could not link Zoom meeting' };
  return { status: 204 };
}

function oauthRedirectUri(request, env) {
  if (env.ZOOM_REDIRECT_URI) return String(env.ZOOM_REDIRECT_URI);
  const url = new URL(request.url);
  return `${url.origin}/zoom-sum-game/oauth/callback`;
}

function oauthConfigMissing(env) {
  return !env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET;
}

async function oauthStart(request, env) {
  if (!env.ZOOM_CLIENT_ID) {
    return htmlPage('Zoom OAuth', '<h1 class="err">OAuth не настроен</h1><p>В Cloudflare отсутствует секрет <code>ZOOM_CLIENT_ID</code>.</p>', 503);
  }

  const state = randomState();
  const redirectUri = oauthRedirectUri(request, env);
  const authorize = new URL('https://zoom.us/oauth/authorize');
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', String(env.ZOOM_CLIENT_ID));
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      'cache-control': 'no-store',
      'set-cookie': `${OAUTH_COOKIE}=${encodeURIComponent(state)}; Max-Age=${OAUTH_MAX_AGE}; Path=/zoom-sum-game/oauth/; Secure; HttpOnly; SameSite=Lax`,
    },
  });
}

async function oauthCallback(request, env) {
  const url = new URL(request.url);
  const zoomError = url.searchParams.get('error');
  if (zoomError) {
    const description = url.searchParams.get('error_description') || zoomError;
    return htmlPage('Zoom OAuth error', `<h1 class="err">Авторизация Zoom не завершена</h1><p>${escapeHtml(description)}</p>`, 400, {
      'set-cookie': `${OAUTH_COOKIE}=; Max-Age=0; Path=/zoom-sum-game/oauth/; Secure; HttpOnly; SameSite=Lax`,
    });
  }

  const code = url.searchParams.get('code') || '';
  if (!code) {
    return htmlPage('Zoom OAuth error', '<h1 class="err">Нет authorization code</h1><p>Zoom не передал параметр <code>code</code>.</p>', 400);
  }

  const returnedState = url.searchParams.get('state') || '';
  const expectedState = getCookie(request, OAUTH_COOKIE);
  if ((returnedState || expectedState) && (!returnedState || !expectedState || returnedState !== expectedState)) {
    return htmlPage('Zoom OAuth error', '<h1 class="err">Неверный OAuth state</h1><p>Повторите авторизацию.</p>', 400, {
      'set-cookie': `${OAUTH_COOKIE}=; Max-Age=0; Path=/zoom-sum-game/oauth/; Secure; HttpOnly; SameSite=Lax`,
    });
  }

  if (oauthConfigMissing(env)) {
    return htmlPage('Zoom OAuth', '<h1 class="err">OAuth не настроен</h1><p>В Cloudflare должны быть заданы <code>ZOOM_CLIENT_ID</code> и <code>ZOOM_CLIENT_SECRET</code>.</p>', 503);
  }

  const redirectUri = oauthRedirectUri(request, env);
  const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });

  let tokenResponse;
  try {
    tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: form.toString(),
    });
  } catch {
    return htmlPage('Zoom OAuth error', '<h1 class="err">Zoom OAuth недоступен</h1><p>Не удалось связаться с token endpoint Zoom. Попробуйте ещё раз.</p>', 502);
  }

  let tokenData = {};
  try { tokenData = await tokenResponse.json(); } catch {}

  if (!tokenResponse.ok || !tokenData.access_token) {
    const reason = tokenData.reason || tokenData.error_description || tokenData.error || `HTTP ${tokenResponse.status}`;
    return htmlPage('Zoom OAuth error', `<h1 class="err">Не удалось завершить OAuth</h1><p>${escapeHtml(reason)}</p><p>Проверьте Client ID/Secret и точное совпадение OAuth Redirect URL.</p>`, 502, {
      'set-cookie': `${OAUTH_COOKIE}=; Max-Age=0; Path=/zoom-sum-game/oauth/; Secure; HttpOnly; SameSite=Lax`,
    });
  }

  const scope = escapeHtml(tokenData.scope || '');
  return htmlPage('Zoom OAuth complete', `<h1 class="ok">Авторизация Zoom завершена</h1><p>Приложение успешно авторизовано. Можно закрыть эту страницу и вернуться в Zoom.</p>${scope ? `<p><small>Scopes: ${scope}</small></p>` : ''}`, 200, {
    'set-cookie': `${OAUTH_COOKIE}=; Max-Age=0; Path=/zoom-sum-game/oauth/; Secure; HttpOnly; SameSite=Lax`,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/zoom-sum-game/api/version') {
      return json({ build: BUILD, oauthConfigured: Boolean(env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET) });
    }

    if (url.pathname === '/zoom-sum-game/api/zoom-meeting-room') {
      if (!sameOrigin(request)) return json({ error: 'Cross-origin request rejected' }, { status: 403 });

      if (request.method === 'GET') {
        const meetingUUID = normalizeMeetingUUID(url.searchParams.get('meetingUUID'));
        if (!meetingUUID) return json({ error: 'Invalid meeting UUID' }, { status: 400 });
        try {
          const room = await lookupMeetingRoom(env, meetingUUID);
          return json({ room });
        } catch {
          return json({ error: 'Could not look up Zoom meeting room' }, { status: 500 });
        }
      }

      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
        const meetingUUID = normalizeMeetingUUID(body.meetingUUID);
        const room = normalizeRoom(body.room);
        const hostSecret = String(body.hostSecret || '');
        if (!meetingUUID || !room || hostSecret.length < 32) return json({ error: 'Invalid meeting, room or host secret' }, { status: 400 });
        const result = await bindMeetingRoom(env, meetingUUID, room, hostSecret);
        if (result.status === 204) return new Response(null, { status: 204 });
        return json({ error: result.error }, { status: result.status });
      }

      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    if (url.pathname === '/zoom-sum-game/oauth/start' && request.method === 'GET') {
      return oauthStart(request, env);
    }

    if (url.pathname === '/zoom-sum-game/oauth/callback' && request.method === 'GET') {
      return oauthCallback(request, env);
    }

    return baseWorker.fetch(request, env, ctx);
  },
};

export class GameRoom extends BaseGameRoom {
  async fetch(request) {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (url.pathname === '/verify-host' && request.method === 'POST') {
      if (!this.room) return new Response('Room not found', { status: 404 });
      let body;
      try { body = await request.json(); } catch { return new Response('Bad request', { status: 400 }); }
      return String(body.hostSecret || '') === this.room.hostSecret
        ? new Response(null, { status: 204 })
        : new Response('Forbidden', { status: 403 });
    }

    if (url.pathname === '/meeting-link') {
      if (request.method === 'GET') {
        const link = await this.ctx.storage.get('meetingLink');
        if (!link || !normalizeRoom(link.room) || Number(link.expiresAt || 0) <= Date.now()) {
          if (link) await this.ctx.storage.delete('meetingLink');
          return new Response('Not found', { status: 404 });
        }
        return json({ room: link.room, expiresAt: link.expiresAt });
      }

      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch { return new Response('Bad request', { status: 400 }); }
        const room = normalizeRoom(body.room);
        const expiresAt = Number(body.expiresAt);
        if (!room || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return new Response('Bad request', { status: 400 });

        const existing = await this.ctx.storage.get('meetingLink');
        if (existing && normalizeRoom(existing.room) && Number(existing.expiresAt || 0) > Date.now() && existing.room !== room) {
          return new Response('Already linked', { status: 409 });
        }

        await this.ctx.storage.put('meetingLink', { room, expiresAt });
        return new Response(null, { status: 204 });
      }
    }

    return super.fetch(request);
  }

  publicStateFor(attachment) {
    const state = super.publicStateFor(attachment);
    const hasTarget = this.room?.target !== null && this.room?.target !== undefined;
    const isHost = attachment?.role === 'host';

    state.hasTarget = hasTarget;
    state.targetVisible = Boolean(this.room?.targetVisible);
    state.liveTarget = hasTarget && (isHost || this.room.targetVisible) ? this.room.target : null;

    if (state.phase !== 'reveal') state.target = state.liveTarget;

    if (state.result && !isHost && !state.result.success && !this.room.targetVisible) {
      state.result = { ...state.result, target: null };
    }

    return state;
  }

  async webSocketMessage(ws, message) {
    await this.ensureLoaded();
    if (!this.room) return;

    let data = null;
    if (typeof message === 'string') {
      try { data = JSON.parse(message); } catch {}
    }

    const attachment = this.getAttachment(ws);
    const isHost = attachment?.role === 'host';

    if (data?.type === 'setTargetVisible') {
      if (!isHost) {
        this.sendError(ws, 'Host permission required');
        return;
      }
      this.room.targetVisible = Boolean(data.visible);
      await this.persist();
      this.broadcast();
      return;
    }

    if (data?.type === 'setTarget') {
      if (!isHost) {
        this.sendError(ws, 'Host permission required');
        return;
      }

      if (data.target === null) {
        this.room.target = null;
      } else {
        const target = Number(data.target);
        if (!Number.isSafeInteger(target) || Math.abs(target) > 1_000_000_000) {
          this.sendError(ws, 'Target must be an integer between -1000000000 and 1000000000');
          return;
        }
        this.room.target = target;
      }

      await this.persist();
      this.broadcast();
      return;
    }

    if (isHost && data?.type === 'startRound') {
      data.targetVisible = Boolean(this.room.targetVisible);
      return super.webSocketMessage(ws, JSON.stringify(data));
    }

    return super.webSocketMessage(ws, message);
  }
}
