import worker, { GameRoom as BaseGameRoom } from './target-visibility.js';

const liveTargetClient = String.raw`
<script>
(()=>{
  const input=document.getElementById('targetInput');
  if(!input)return;

  let socket=null;
  let retry=null;
  let pendingValue=undefined;
  let connectedRoom='';

  function credentials(){
    const pageUrl=new URL(location.href);
    const room=String(pageUrl.searchParams.get('room')||'').toUpperCase();
    const secret=room?(pageUrl.searchParams.get('host')||localStorage.getItem('zoomSumGameHost:'+room)||''):'';
    const clientId=localStorage.getItem('zoomSumGameClientId')||'';
    return {room,secret,clientId};
  }

  function sendPending(){
    if(socket?.readyState===WebSocket.OPEN && pendingValue!==undefined){
      socket.send(JSON.stringify({type:'setTarget',target:pendingValue}));
      pendingValue=undefined;
    }
  }

  function connect(){
    clearTimeout(retry);
    const {room,secret,clientId}=credentials();
    if(!room){retry=setTimeout(connect,400);return}
    if(!secret||!clientId)return;
    if(socket && connectedRoom===room && (socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
    try{socket?.close()}catch{}
    connectedRoom=room;
    const u=new URL('/zoom-sum-game/api/ws',location.origin);
    u.protocol=location.protocol==='https:'?'wss:':'ws:';
    u.searchParams.set('room',room);
    u.searchParams.set('clientId',clientId);
    u.searchParams.set('role','host');
    u.searchParams.set('secret',secret);
    socket=new WebSocket(u);
    socket.onopen=sendPending;
    socket.onmessage=(event)=>{
      try{
        const s=JSON.parse(event.data);
        if(s.type!=='state')return;
        if(document.activeElement!==input){
          input.value=s.hasTarget && Number.isSafeInteger(s.target) ? String(s.target) : '';
        }
      }catch{}
    };
    socket.onclose=()=>{retry=setTimeout(connect,1000)};
  }

  input.addEventListener('input',()=>{
    const raw=input.value.trim();
    if(raw===''){
      pendingValue=null;
    }else if(/^-?\d+$/.test(raw)){
      const value=Number(raw);
      if(!Number.isSafeInteger(value)||Math.abs(value)>1000000000)return;
      pendingValue=value;
    }else{
      return;
    }
    sendPending();
    if(!socket||socket.readyState>1)connect();
  });

  connect();
})();
</script>`;

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

    const targetExpression = "!state?.hasTarget?'—':(state?.targetVisible?(state?.target??'—'):'?')";

    html = html.replaceAll(
      "$('hostChoice').textContent='—';",
      `$('hostChoice').textContent=${targetExpression};`
    );
    html = html.replaceAll(
      "$('hostChoice').textContent=Number.isInteger(me.value)?me.value:'—';",
      `$('hostChoice').textContent=${targetExpression};`
    );

    html = html.replace(
      "if(state.phase!=='choosing'){$('targetDisplay').textContent='—';",
      `if(state.phase!=='choosing'){$('targetDisplay').textContent=${targetExpression};`
    );
    html = html.replace(
      "$('targetDisplay').textContent=state.target===null?'?':state.target;",
      `$('targetDisplay').textContent=${targetExpression};`
    );

    html = html.replace(
      "$('startRound').onclick=()=>{const v=Number($('targetInput').value);if(!Number.isSafeInteger(v))return msg('Введите целое число');",
      "$('startRound').onclick=()=>{const raw=$('targetInput').value.trim();if(raw==='')return msg('Введите целое число');const v=Number(raw);if(!Number.isSafeInteger(v))return msg('Введите целое число');"
    );

    html = html.replace('</body>', liveTargetClient + '\n</body>');

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

export class GameRoom extends BaseGameRoom {
  publicStateFor(attachment) {
    const state = super.publicStateFor(attachment);
    const hasTarget = this.room?.target !== null && this.room?.target !== undefined;
    const isHost = attachment?.role === 'host';

    state.hasTarget = hasTarget;
    if (state.phase !== 'reveal') {
      state.target = hasTarget && (isHost || this.room.targetVisible) ? this.room.target : null;
    }
    return state;
  }

  async webSocketMessage(ws, message) {
    await this.ensureLoaded();
    if (!this.room) return;

    let data=null;
    if(typeof message==='string'){
      try{data=JSON.parse(message)}catch{}
    }

    if(data?.type==='setTarget'){
      const attachment=this.getAttachment(ws);
      if(attachment.role!=='host'){
        this.sendError(ws,'Host permission required');
        return;
      }

      if(data.target===null){
        this.room.target=null;
      }else{
        const target=Number(data.target);
        if(!Number.isSafeInteger(target)||Math.abs(target)>1000000000){
          this.sendError(ws,'Target must be an integer between -1000000000 and 1000000000');
          return;
        }
        this.room.target=target;
      }

      await this.persist();
      this.broadcast();
      return;
    }

    return super.webSocketMessage(ws,message);
  }
}
