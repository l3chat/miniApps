import baseWorker, { GameRoom as BaseGameRoom } from './index.js';

const visibilityClient = String.raw`
<script>
(()=>{
  const checkbox=document.getElementById('targetVisible');
  if(!checkbox)return;

  const label=checkbox.closest('label');
  if(label){
    for(const node of label.childNodes){
      if(node.nodeType===Node.TEXT_NODE && node.textContent.trim()){
        node.textContent=' Показывать цель';
      }
    }
  }

  const pageUrl=new URL(location.href);
  const room=String(pageUrl.searchParams.get('room')||'').toUpperCase();
  const hostKey='zoomSumGameHost:'+room;
  const secret=pageUrl.searchParams.get('host')||localStorage.getItem(hostKey)||'';
  const clientId=localStorage.getItem('zoomSumGameClientId')||'';
  if(!room||!secret||!clientId)return;

  let socket=null;
  let retry=null;
  let desired=null;

  function sendVisibility(){
    if(socket?.readyState===WebSocket.OPEN && desired!==null){
      socket.send(JSON.stringify({type:'setTargetVisible',visible:desired}));
      desired=null;
    }
  }

  function connect(){
    clearTimeout(retry);
    if(socket && (socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
    const u=new URL('/zoom-sum-game/api/ws',location.origin);
    u.protocol=location.protocol==='https:'?'wss:':'ws:';
    u.searchParams.set('room',room);
    u.searchParams.set('clientId',clientId);
    u.searchParams.set('role','host');
    u.searchParams.set('secret',secret);
    socket=new WebSocket(u);
    socket.onopen=sendVisibility;
    socket.onmessage=(event)=>{
      try{
        const state=JSON.parse(event.data);
        if(state.type==='state')checkbox.checked=Boolean(state.targetVisible);
      }catch{}
    };
    socket.onclose=()=>{retry=setTimeout(connect,1000)};
  }

  checkbox.addEventListener('change',()=>{
    desired=checkbox.checked;
    sendVisibility();
    if(!socket||socket.readyState>1)connect();
  });

  connect();
})();
</script>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isGameIndex = request.method === 'GET' &&
      (url.pathname === '/zoom-sum-game/' || url.pathname === '/zoom-sum-game/index.html');

    if (!isGameIndex) return baseWorker.fetch(request, env, ctx);

    const response = await env.ASSETS.fetch(request);
    if (!response.ok) return response;

    let html = await response.text();
    html = html.replace('Показывать сразу', 'Показывать цель');
    html = html.replace('</body>', visibilityClient + '\n</body>');

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-cache');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  },
};

export class GameRoom extends BaseGameRoom {
  publicStateFor(attachment) {
    const state = super.publicStateFor(attachment);
    state.hasTarget = this.room?.target !== null && this.room?.target !== undefined;
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
    const isHost = attachment.role === 'host';

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

    if (isHost && data?.type === 'startRound') {
      data.targetVisible = Boolean(this.room.targetVisible);
      return super.webSocketMessage(ws, JSON.stringify(data));
    }

    return super.webSocketMessage(ws, message);
  }
}
