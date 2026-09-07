import baseWorker, { GameRoom as BaseGameRoom } from './index.js';

const BUILD = '2026-09-07-static-v1';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/zoom-sum-game/api/version') {
      return json({ build: BUILD });
    }
    return baseWorker.fetch(request, env, ctx);
  },
};

export class GameRoom extends BaseGameRoom {
  publicStateFor(attachment) {
    const state = super.publicStateFor(attachment);
    const hasTarget = this.room?.target !== null && this.room?.target !== undefined;
    const isHost = attachment?.role === 'host';

    state.hasTarget = hasTarget;
    state.targetVisible = Boolean(this.room?.targetVisible);
    state.liveTarget = hasTarget && (isHost || this.room.targetVisible) ? this.room.target : null;

    if (state.phase !== 'reveal') {
      state.target = state.liveTarget;
    }

    // Do not send a failed hidden target to participants. A successful round always reveals it.
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
      // Starting a round must not change the live Show target checkbox state.
      data.targetVisible = Boolean(this.room.targetVisible);
      return super.webSocketMessage(ws, JSON.stringify(data));
    }

    return super.webSocketMessage(ws, message);
  }
}
