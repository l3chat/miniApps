import vm from 'node:vm';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Load the unmodified GitHub source. Only platform services are simulated.
export async function loadGame() {
  const clock = { now: 1_800_000_000_000 };
  class AuditDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } }
  class Socket {
    static OPEN = 1;
    constructor() { this.readyState = 1; this.messages = []; this.attachment = {}; }
    serializeAttachment(a) { this.attachment = structuredClone(a); }
    deserializeAttachment() { return structuredClone(this.attachment); }
    send(message) { this.messages.push(JSON.parse(message)); this.onSend?.(message); }
    close() { this.readyState = 3; }
  }
  class Storage {
    constructor() { this.data = new Map(); this.alarm = null; }
    async transaction(fn) { const previous=this.queue||Promise.resolve();let release;this.queue=new Promise(r=>{release=r});await previous;try{return await fn(this)}finally{release()} }
    async get(k) { return structuredClone(this.data.get(k)); }
    async put(k,v) { this.data.set(k,structuredClone(v)); }
    async delete(k) { return this.data.delete(k); }
    async deleteAll() { this.data.clear(); }
    async setAlarm(t) { this.alarm = t; }
    async deleteAlarm() { this.alarm = null; }
  }
  function CFResponse(body,init={}) {
    if (init.status === 101) return {status:101,webSocket:init.webSocket};
    return new Response(body,init);
  }
  const requests = [];
  const context = vm.createContext({
    Request, Response:CFResponse, Headers, URL, URLSearchParams, TextEncoder,
    crypto:globalThis.crypto, btoa, console, Date:AuditDate, WebSocket:Socket,
    WebSocketPair: class { constructor() { this[0]=new Socket(); this[1]=new Socket(); } },
    fetch: async (url,options) => { requests.push({url,options}); return new Response(JSON.stringify({access_token:'audit-token',scope:'zoomapp:inmeeting'})); },
  });
  const platform = new vm.SyntheticModule(['DurableObject'], function() { this.setExport('DurableObject',class {}); },{context});
  const base = new vm.SourceTextModule(await fs.readFile(new URL('../../worker-src/index.js',import.meta.url),'utf8'),{context,identifier:'worker-src/index.js'});
  await base.link(()=>platform);
  const ui = new vm.SourceTextModule(await fs.readFile(new URL('../../worker-src/ui.js',import.meta.url),'utf8'),{context,identifier:'worker-src/ui.js'});
  await ui.link(()=>base);
  await ui.evaluate();
  const instances = new Map();
  const env = { GAME_ROOMS:{ idFromName: name => name, get(name) { return {fetch:async (request,init)=>actor(name).fetch(typeof request==='string'?new Request(request,init):request)}; } } };
  function actor(name) {
    if (!instances.has(name)) {
      const ctx={storage:new Storage(),sockets:[],getWebSockets() { return this.sockets; },acceptWebSocket(ws) { this.sockets.push(ws); }};
      instances.set(name,new ui.namespace.GameRoom(ctx,env));
    }
    return instances.get(name);
  }
  const secret='local-audit-host-secret-0123456789';
  async function room(code='ABC234') {
    const r=actor(code);
    const response=await r.fetch(new Request('https://room.internal/create',{method:'POST',body:JSON.stringify({room:code,hostSecret:secret})}));
    assert.equal(response.status,201);
    return r;
  }
  async function connect(r,clientId,role='player',suppliedSecret=secret,resumeToken='') {
    const u=new URL('https://room.internal/websocket');
    u.searchParams.set('resumeToken',resumeToken);u.searchParams.set('clientId',clientId);u.searchParams.set('role',role);u.searchParams.set('secret',suppliedSecret);
    const response=await r.fetch(new Request(u,{headers:{Upgrade:'websocket'}}));
    if(response.status!==101) return {response};
    return r.ctx.sockets.at(-1);
  }
  const command=(r,s,d)=>r.webSocketMessage(s,JSON.stringify({round:r.room.round,...d}));
  async function player(r,id,name=id) { const s=await connect(r,id); await command(r,s,{type:'join',name});return s; }
  async function start(r,h,target=5,countdownMode=false) { await command(r,h,{type:'startRound',target,countdownMode}); }
  return {clock,actor,env,worker:ui.namespace.default,room,connect,player,command,start,secret,requests};
}

