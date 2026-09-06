import baseWorker, { GameRoom as BaseGameRoom } from './index.js';

const viewportStyle = String.raw`
<style id="single-viewport-ui">
html,body{width:100%;height:100%;min-height:0;overflow:hidden}
body{overscroll-behavior:none}
.wrap{width:100%;height:100dvh;min-height:0;max-width:1100px;padding:clamp(4px,1.2vmin,10px);gap:clamp(4px,1.2vmin,10px);grid-template-rows:minmax(28px,auto) minmax(0,1fr);overflow:hidden}
header{min-height:0;gap:6px}.brand{font-size:clamp(.82rem,2.2vmin,1.05rem)}.topmeta{gap:5px;font-size:clamp(.65rem,1.8vmin,.82rem)}
#homeBtn{padding:5px 8px!important}.dot{width:7px;height:7px}
main{height:100%;min-height:0;overflow:hidden;gap:clamp(4px,1.2vmin,10px)}
#landing,#playerPanel,#hostPanel{height:100%;min-height:0;overflow:hidden}
.card{padding:clamp(7px,1.7vmin,15px);border-radius:clamp(10px,2vmin,16px)}
.grid{gap:clamp(5px,1.4vmin,12px)}
h2{font-size:clamp(1rem,2.8vmin,1.35rem)}
input[type=text],input[type=number]{padding:clamp(7px,1.5vmin,11px);border-radius:10px;min-height:0}
button{padding:clamp(7px,1.5vmin,11px) clamp(9px,2vmin,15px);border-radius:10px;min-height:0}
details{padding:clamp(6px,1.3vmin,9px);border-radius:10px;min-height:0}summary{font-size:clamp(.78rem,2vmin,.95rem)}
details[open] .players{max-height:18dvh;overflow:auto;overscroll-behavior:contain}
.message{position:absolute;left:8px;right:8px;bottom:8px;z-index:50;padding:7px 9px;font-size:.82rem}

/* Participant: target + six choices + readiness/result always fit. */
#playerPanel:not(.hidden){display:grid;min-height:0;height:100%}
#playerJoin{align-self:center;max-height:100%;overflow:hidden}
.playzone{height:100%;min-height:0;align-content:stretch;grid-template-rows:auto minmax(0,1fr) auto auto auto;gap:clamp(4px,1.4vh,12px)}
.target{min-height:0}.target .label{font-size:clamp(.62rem,1.8vmin,.8rem)}.target .value{font-size:clamp(1.6rem,8vmin,4.5rem);line-height:.95}
.numbers{min-height:0;height:100%;gap:clamp(5px,1.4vmin,12px);grid-auto-rows:minmax(0,1fr)}
.numberbtn{height:100%;min-height:0!important;font-size:clamp(1.45rem,6vmin,3.4rem);border-radius:clamp(10px,2.5vmin,18px);padding:2px}
.readybtn{min-height:clamp(42px,8.5dvh,72px);font-size:clamp(1.05rem,3.5vmin,1.8rem);padding:5px 12px}
.hint{font-size:clamp(.68rem,1.9vmin,.88rem);min-height:1em;line-height:1.1}
#playerPlay>details{padding:5px 8px}
.resultCard{height:100%;min-height:0;overflow:hidden;display:grid;align-content:center;gap:clamp(5px,1.6vmin,14px);padding:clamp(10px,2.5vmin,24px)}
.resultWord{font-size:clamp(2rem,9vmin,5.2rem)}.scoreline{margin:clamp(4px,1.5vmin,12px) 0;gap:clamp(16px,7vmin,60px)}.scorebox .n{font-size:clamp(1.8rem,7vmin,4rem)}
.resultCard details[open]{max-height:30dvh;overflow:hidden}.resultCard details[open] .players{max-height:22dvh;overflow:auto}

/* Host: room strip, controls and own move remain inside the same viewport. */
#hostPanel:not(.hidden){display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:100%;min-height:0;gap:clamp(4px,1.2vmin,10px)}
#hostPanel>.card:first-child{padding:clamp(5px,1.2vmin,9px)}
.roomcode{font-size:clamp(1.05rem,3.7vmin,1.55rem);line-height:1;letter-spacing:.09em}
#hostPanel>.card:first-child .small{font-size:.68rem}
#hostPanel>.card:first-child button{padding:clamp(5px,1.1vmin,8px) clamp(7px,1.6vmin,11px);font-size:clamp(.68rem,1.8vmin,.85rem)}
.hostLayout{height:100%;min-height:0;overflow:hidden;gap:clamp(5px,1.2vmin,10px);grid-template-columns:minmax(250px,.85fr) minmax(280px,1.15fr)}
.hostControls,.hostPlay{min-height:0;overflow:hidden}.hostControls{grid-template-rows:minmax(0,1fr) auto}
.hostControls>.card{min-height:0;overflow:hidden;align-content:center}
.hostControls>.card h2,.hostPlay h2{margin:0}
.hostControls label{font-size:clamp(.72rem,1.8vmin,.9rem);gap:3px}
.hostControls>.card button{font-size:clamp(.7rem,1.8vmin,.9rem)}
.hostControls>details{align-self:end}
.hostPlay{align-content:center}.hostJoin{gap:clamp(4px,1vmin,8px)}.hostJoin p{font-size:clamp(.68rem,1.7vmin,.85rem)}
.hostPlay .target .value{font-size:clamp(1.5rem,5vmin,3.2rem)}
.hostPlay .numbers{height:auto;grid-template-columns:repeat(6,1fr)}
.hostPlay .numberbtn{height:clamp(38px,8dvh,68px);min-height:0!important;font-size:clamp(1.15rem,3.6vmin,2rem);border-radius:10px}
.hostPlay .readybtn{min-height:clamp(38px,7dvh,58px);font-size:clamp(.9rem,2.5vmin,1.15rem)}
.hostResult{height:auto;max-height:100%;margin-top:0}

@media(max-width:699px){
  .wrap{max-width:none}
  .hostLayout{grid-template-columns:1fr;grid-template-rows:minmax(0,.9fr) minmax(0,1.1fr)}
  .hostControls>.card{grid-template-columns:1fr 1fr;grid-auto-rows:min-content;column-gap:8px;row-gap:5px}
  .hostControls>.card h2{grid-column:1/-1}
  .hostControls>.card>label:first-of-type{grid-column:1/-1}
  .hostControls>.card button{padding:7px 8px}
  .hostControls{gap:5px}
  .hostPlay{padding:7px 9px}
  .hostJoin p{display:none}
}

@media(max-height:620px){
  .wrap{padding:4px;gap:4px;grid-template-rows:24px minmax(0,1fr)}
  header{height:24px}.brand{font-size:.78rem}.topmeta{font-size:.62rem}
  .card{padding:6px 8px}.grid{gap:4px}
  h2{font-size:.92rem}label{gap:2px}
  input[type=text],input[type=number]{padding:5px 7px;font-size:.82rem}
  button{padding:5px 7px;font-size:.78rem}
  .playzone{gap:4px}.target .value{font-size:clamp(1.25rem,7vmin,2.3rem)}
  .readybtn{min-height:34px;font-size:1rem}.hint{font-size:.65rem}
  #playerPlay>details{padding:3px 6px}
  .hostLayout{grid-template-columns:minmax(210px,.8fr) minmax(250px,1.2fr);grid-template-rows:1fr}
  .hostControls>.card{grid-template-columns:1fr 1fr;grid-auto-rows:min-content;column-gap:6px;row-gap:3px}
  .hostControls>.card h2{grid-column:1/-1}.hostControls>.card>label:first-of-type{grid-column:1/-1}
  .hostControls>details{padding:4px 6px}.hostJoin p{display:none}
  .hostPlay .numberbtn{height:34px}.hostPlay .readybtn{min-height:32px}.hostPlay .target .value{font-size:1.6rem}
}

@media(max-width:420px) and (min-height:621px){
  .topmeta #conn{display:none}
  .roomcode{font-size:1rem}
  #hostPanel>.card:first-child .row{flex-wrap:nowrap}
  #hostPanel>.card:first-child .grow{flex:1 1 auto;min-width:70px}
  #hostPanel>.card:first-child button{padding:5px 6px;font-size:.68rem}
  .numberbtn{font-size:clamp(1.4rem,8vw,2.4rem)}
}
</style>`;

const visibilityClient = String.raw`
<script>
(()=>{
  const checkbox=document.getElementById('targetVisible');
  if(!checkbox)return;

  const label=checkbox.closest('label');
  if(label){
    for(const node of label.childNodes){
      if(node.nodeType===Node.TEXT_NODE && node.textContent.trim()) node.textContent=' Показывать цель';
    }
  }

  let socket=null;
  let retry=null;
  let desired=null;
  let connectedRoom='';

  function credentials(){
    const pageUrl=new URL(location.href);
    const room=String(pageUrl.searchParams.get('room')||'').toUpperCase();
    const secret=room?(pageUrl.searchParams.get('host')||localStorage.getItem('zoomSumGameHost:'+room)||''):'';
    const clientId=localStorage.getItem('zoomSumGameClientId')||'';
    return {room,secret,clientId};
  }

  function sendVisibility(){
    if(socket?.readyState===WebSocket.OPEN && desired!==null){
      socket.send(JSON.stringify({type:'setTargetVisible',visible:desired}));
      desired=null;
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
    html = html.replace('<details open><summary>Участники', '<details><summary>Участники');
    html = html.replace('</head>', viewportStyle + '\n</head>');
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
