import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// A narrow DOM/network/clock adapter for the original application script.
// This tests event logic, not layout or browser-engine compatibility.
class Classes {
 constructor(value=''){this.values=new Set(value.split(/\s+/).filter(Boolean));}
 add(...v){v.forEach(x=>this.values.add(x));} remove(...v){v.forEach(x=>this.values.delete(x));}
 contains(v){return this.values.has(v);} toggle(v,force){const add=force??!this.contains(v);add?this.add(v):this.remove(v);return add;}
}
export class Element {
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.id=attrs.id||'';this.attrs={...attrs};this.classList=new Classes(attrs.class);this.children=[];this.dataset={};this.value=attrs.value||'';this.checked='checked' in attrs;this.disabled='disabled' in attrs;this.listeners={};this.textContent='';this.innerHTML='';for(const [k,v] of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
 set className(v){this.classList=new Classes(v);} get className(){return [...this.classList.values].join(' ');}
 appendChild(e){this.children.push(e);return e;} addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
 getAttribute(k){return this.attrs[k]??null;} setAttribute(k,v){this.attrs[k]=v;}
 click(){if(!this.disabled)return this.onclick?.();} dispatch(k,event={}){for(const f of this.listeners[k]||[])f(event);}
}
function documentFor(html){
 const all=[];const ids=new Map();
 for(const match of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)){
  const attrs={};for(const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';
  const e=new Element(match[1],attrs);all.push(e);if(e.id)ids.set(e.id,e);
 }
 const document={all,ids,documentElement:all.find(x=>x.tagName==='HTML'),title:'',activeElement:null,hidden:false,listeners:{},getElementById:id=>ids.get(id),createElement:t=>new Element(t),querySelectorAll:q=>q==='[data-i18n]'?all.filter(e=>'i18n' in e.dataset):q==='[data-i18n-placeholder]'?all.filter(e=>'i18nPlaceholder' in e.dataset):[],addEventListener(k,f){(this.listeners[k]??=[]).push(f);},dispatch(k){for(const f of this.listeners[k]||[])f();}};
 return document;
}
function runtime(html,href,stored={}){
 const clock={now:1_800_000_000_000};let seq=0;const timers=new Map();const events={};
 const schedule=(fn,ms,repeat)=>{const id=++seq;timers.set(id,{fn,at:clock.now+ms,repeat});return id;};
 const storage=new Map(Object.entries(stored));const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))};
 const location={url:new URL(href),get href(){return this.url.href;},set href(v){this.url=new URL(v,this.url);},get origin(){return this.url.origin;},get protocol(){return this.url.protocol;},reload(){this.reloaded=true;}};
 const document=documentFor(html);
 class AuditDate extends Date {constructor(...a){super(...(a.length?a:[clock.now]));}static now(){return clock.now;}}
 const context={document,location,localStorage,AbortController,Promise,navigator:{languages:['en'],language:'en',clipboard:{async writeText(value){context.copiedText=String(value)}}},URL,Date:AuditDate,crypto:{randomUUID:()=> 'local-audit-client'},console:{info(){},warn(){},error(){}},history:{replaceState(_s,_t,u){location.href=u;}},setTimeout:(f,t=0)=>schedule(f,t,0),clearTimeout:id=>timers.delete(id),setInterval:(f,t)=>schedule(f,t,t),clearInterval:id=>timers.delete(id),addEventListener(k,f){(events[k]??=[]).push(f);}};
 context.window=context;
 async function tick(ms){const end=clock.now+ms;let runs=0;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;const[id,t]=next;clock.now=t.at;t.repeat?t.at+=t.repeat:timers.delete(id);await t.fn();if(++runs>10000)throw Error('too many timers');}clock.now=end;await Promise.resolve();}
 return {context,clock,timers,storage,document,location,localStorage,tick,events};
}
const clientHtml=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
const wrapperHtml=await fs.readFile(new URL('../zoom.html',import.meta.url),'utf8');
const script=html=>html.match(/<script>([\s\S]*?)<\/script>/)[1];
export function client({host=false,stored={}}={}){
 const e=runtime(clientHtml,'https://audit.local/zoom-sum-game/?room=ABC234'+(host?'&host=local-audit-host-secret-0123456789':''),stored);
 const sockets=[];
 class Socket {static OPEN=1;static CONNECTING=0;constructor(url){this.url=String(url);this.readyState=0;this.messages=[];sockets.push(this);}open(){this.readyState=1;this.onopen?.();}send(s){this.messages.push(JSON.parse(s));}receive(d){this.onmessage?.({data:JSON.stringify(d)});}close(){this.readyState=3;this.onclose?.();}}
 e.context.WebSocket=Socket;e.context.fetch=async()=>{throw Error('unexpected fetch');};
 vm.runInNewContext(script(clientHtml).replace('function detectLang()','window.__I18N=I18N;function detectLang()'),e.context,{filename:'zoom-sum-game/index.html'});
 e.sockets=sockets;e.$=id=>e.document.getElementById(id);
 e.state=(extra={})=>({type:'state',room:'ABC234',serverNow:e.clock.now,phase:'choosing',round:1,targetRound:1,hasTarget:true,targetVisible:false,liveTarget:null,target:null,countdownMode:true,countdownEndsAt:e.clock.now-1,autoRevealAt:null,players:[{clientId:'local-audit-client',name:'Tester',ready:false,chosen:false}],allReady:false,me:{name:'Tester',value:null,ready:false,eligible:true},result:null,...extra});
 return e;
}
export async function wrapper({lookup=null,uuidFails=false,stored={},bindStatus=204}={}){
 const e=runtime(wrapperHtml,'https://audit.local/zoom-sum-game/zoom.html',stored);const calls={lookup:0,bind:0,uuid:0,name:0,config:0};let currentLookup=lookup,currentUuid='audit-meeting',runningContext='inMeeting';const sdkEvents={};
 const frame=e.document.getElementById('game');const childName=new Element('input',{id:'nameInput'}),enter=new Element('button',{id:'saveName'});let enterClicks=0;enter.onclick=()=>{enterClicks++;};
 frame.contentWindow={zoomSumGame:{context(){const u=new URL(frame.contentWindow.location.href);const room=u.searchParams.get('room')||'';const hostSecret=u.searchParams.get('host')||stored['zoomSumGameHost:'+room]||'';return {room,role:hostSecret?'host':'player',hostSecret,joined:false,connected:true}},enterParticipant(name){childName.value=name;enter.click();return true},notice(key){calls.notice=key}},location:{href:'https://audit.local/zoom-sum-game/index.html'},localStorage:e.localStorage,document:{getElementById:id=>({nameInput:childName,saveName:enter}[id])}};
 Object.defineProperty(frame,'src',{get:()=>frame.attrs.src,set(value){frame.attrs.src=value;frame.contentWindow.location.href=new URL(value,'https://audit.local').href;e.context.setTimeout(()=>frame.dispatch('load'),0);}});
 e.context.zoomSdk={config:async()=>{calls.config++;return {};},onRunningContextChange:fn=>{sdkEvents.running=fn},onMyUserContextChange:fn=>{sdkEvents.user=fn},getRunningContext:async()=>({context:runningContext}),getUserContext:async()=>{calls.name++;return{screenName:'Zoom Tester'};},getMeetingUUID:async()=>{calls.uuid++;if(uuidFails)throw Error('not in meeting');return{meetingUUID:currentUuid};}};
 e.context.fetch=async(_u,options={})=>{if(options.method==='POST'){calls.bind++;return new Response(bindStatus===204?null:JSON.stringify({error:'Already linked'}),{status:bindStatus});}calls.lookup++;return new Response(JSON.stringify({room:currentLookup}));};
 vm.runInNewContext(script(wrapperHtml),e.context,{filename:'zoom-sum-game/zoom.html'});
 for(let i=0;i<80;i++)await Promise.resolve();
 await e.tick(0);
 return {...e,calls,frame,get enterClicks(){return enterClicks;},setLookup(v){currentLookup=v;},setUuidFailure(v){uuidFails=v},async changeMeeting(uuid){currentUuid=uuid;sdkEvents.running?.();for(let i=0;i<80;i++)await Promise.resolve();await e.tick(0)},childName};
}
