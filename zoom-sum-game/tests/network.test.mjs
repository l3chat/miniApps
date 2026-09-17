import test from 'node:test';
import assert from 'node:assert/strict';
import {client} from './client-adapter.mjs';
import {loadGame} from './server-adapter.mjs';
for(const round of [1,2])test(`NET-2 lost selection recovers in round ${round}`,async()=>{
 const e=client(),s=e.sockets[0];s.open();s.receive(e.state({countdownMode:true,countdownEndsAt:e.clock.now-1000}));
 e.$('numbers').children[2].click();assert.ok(e.$('numbers').children.every(b=>b.disabled));
 s.close();await e.tick(1000);const next=e.sockets.at(-1);next.open();next.receive(e.state({round,countdownMode:true,countdownEndsAt:e.clock.now-1000}));
 assert.ok(e.$('numbers').children.every(b=>!b.disabled));
});
test('NET-2 accepted selection stays locked after reconnect',async()=>{
 const e=client(),s=e.sockets[0];s.open();s.receive(e.state({countdownMode:true,countdownEndsAt:e.clock.now-1000}));e.$('numbers').children[2].click();
 s.close();await e.tick(1000);const next=e.sockets.at(-1);next.open();next.receive(e.state({countdownMode:true,countdownEndsAt:e.clock.now-1000,me:{name:'T',value:2,ready:true,eligible:true}}));
 assert.ok(e.$('numbers').children.every(b=>b.disabled));
});
test('NET-1 no offline game command is replayed before or after snapshot',async()=>{
 const e=client(),s=e.sockets[0];s.open();s.receive(e.state({me:{name:'T',value:2,ready:false,eligible:true}}));s.close();
 e.$('numbers').children[4].click();e.$('readyBtn').click();await e.tick(1000);const next=e.sockets.at(-1);next.open();assert.equal(next.messages.length,0);next.receive(e.state({round:2}));assert.equal(next.messages.length,0);
});
test('NET-1 server rejects old round and roundless mutations',async()=>{
 const g=await loadGame(),r=await g.room(),h=await g.connect(r,'host','host'),p=await g.player(r,'p');
 await g.start(r,h,4);await g.start(r,h,3);
 for(const round of [1,undefined]){await g.command(r,p,{type:'select',value:4,round});await g.command(r,p,{type:'setReady',ready:true,round});}
 assert.equal(r.room.players.p.value,null);assert.equal(r.room.players.p.ready,false);
});
test('NET-3 blackholed OPEN socket reconnects; active pongs keep it alive',async()=>{
 const e=client(),s=e.sockets[0];s.open();s.receive(e.state());await e.tick(35000);assert.equal(e.sockets.length,2);
 const a=client(),as=a.sockets[0];as.open();as.receive(a.state());for(let i=0;i<12;i++){await a.tick(5000);as.receive({type:'pong'});}assert.equal(a.sockets.length,1);
});
test('Countdown is the only mode offered by the client',()=>{
 const e=client({host:true}),s=e.sockets[0];s.open();s.receive(e.state({countdownMode:true,liveTarget:5}));
 assert.equal(e.$('countdownMode'),undefined);e.$('targetInput').value='5';e.$('startRound').click();assert.equal(s.messages.at(-1).countdownMode,true);
});
test('UI-3 connection status follows selected language',()=>{const e=client(),s=e.sockets[0];s.open();s.receive(e.state());e.$('langSelect').onchange({target:{value:'ru'}});assert.equal(e.$('conn').textContent,'в сети');});
