import worker, { GameRoom as BaseGameRoom } from './target-visibility.js';

export default {
  async fetch(request, env, ctx) {
    const response = await worker.fetch(request, env, ctx);
    const url = new URL(request.url);
    const isGameIndex = request.method === 'GET' &&
      (url.pathname === '/zoom-sum-game/' || url.pathname === '/zoom-sum-game/index.html');

    if (!isGameIndex || !response.ok) return response;

    let html = await response.text();
    html = html.replace(
      '<div class="label">Ваш выбор</div><div id="hostChoice"',
      '<div class="label">Цель</div><div id="hostChoice"'
    );

    const hostTargetExpression = "state?.target??state?.result?.target??'—'";
    html = html.replaceAll(
      "$('hostChoice').textContent='—';",
      `$('hostChoice').textContent=${hostTargetExpression};`
    );
    html = html.replaceAll(
      "$('hostChoice').textContent=Number.isInteger(me.value)?me.value:'—';",
      `$('hostChoice').textContent=${hostTargetExpression};`
    );

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-cache');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export class GameRoom extends BaseGameRoom {}
