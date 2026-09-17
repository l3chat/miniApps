import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './server-adapter.mjs';
import {client} from './client-adapter.mjs';
async function setup(){const g=await loadGame(),r=await g.room(),h=await g.connect(r,'host','host'),p=await g.player(r,'p');return {g,r,h,p};}
test('SEC-2 a public player ID cannot resume or change a player',async()=>{
 const {g,r,p}=await setup();const token=p.messages.find(x=>x.type==='session').resumeToken;
 const attack=await g.connect(r,'p');assert.equal(attack.readyState,3);assert.equal(attack.messages[0].type,'sessionReset');
 await g.command(r,attack,{type:'join',name:'Intruder'});assert.equal(r.room.players.p.name,'p');
 const again=await g.connect(r,'p','player',g.secret,token);assert.equal(again.readyState,1);assert.equal(r.getActivePlayers().length,1);
 const publicState=r.publicStateFor({clientId:'p',role:'player'});assert.ok(!JSON.stringify(publicState).includes(token));
});
test('SEC-2 legacy sockets and persisted identities require explicit renewal',async()=>{
 const {g,r}=await setup();r.room.players.old={name:'Old',value:3,ready:true,joinedAt:g.clock.now};
 const socket=await g.connect(r,'old');assert.equal(socket.messages[0].type,'sessionReset');
 const fresh=await g.player(r,'fresh');fresh.serializeAttachment({clientId:'old',role:'player'});
 await g.command(r,fresh,{type:'join',name:'Stolen'});assert.equal(r.room.players.old.name,'Old');
});
for(const target of [1,17])for(const visible of [false,true])test(`SEC-1 result target=${target} visible=${visible}`,async()=>{
 const {g,r,h,p}=await setup();await g.start(r,h,target);g.clock.now+=3001;await g.command(r,p,{type:'select',value:1});g.clock.now+=2000;await r.alarm();
 await g.command(r,h,{type:'setTargetVisible',visible});const state=r.publicStateFor({clientId:'p',role:'player'});
 assert.equal(state.target,target===1||visible?target:null);assert.equal(state.result.target,state.target);
 assert.equal(state.liveTarget,visible?target:null);
});
test('Countdown is mandatory and host participation still works',async()=>{
 const {g,r,h,p}=await setup();await g.command(r,h,{type:'join',name:'Host'});await g.start(r,h,5,false);assert.equal(r.room.countdownMode,true);assert.ok(r.room.countdownEndsAt);
 g.clock.now+=3001;await g.command(r,p,{type:'select',value:3});await g.command(r,p,{type:'select',value:4});assert.equal(r.room.players.p.value,3);
 await g.command(r,h,{type:'select',value:2});g.clock.now+=2000;await r.alarm();assert.equal(r.room.result.success,true);assert.equal(r.room.result.sum,5);
});
test('Round numbering tracks the current target and the total round',async()=>{
 const {g,r,h}=await setup();
 await g.start(r,h,4);assert.equal(r.room.targetRound,1);assert.equal(r.room.round,1);
 await g.start(r,h,4);assert.equal(r.room.targetRound,2);assert.equal(r.room.round,2);
 await g.start(r,h,7);assert.equal(r.room.targetRound,1);assert.equal(r.room.round,3);
 const state=r.publicStateFor(h.deserializeAttachment());assert.equal(state.targetRound,1);assert.equal(state.round,3);
 r.room.result=r.makeResult(r.getRoundPlayers());assert.equal(r.room.result.targetRound,1);assert.equal(r.room.result.round,3);
 delete r.room.targetRound;delete r.room.roundTarget;r.room.phase='reveal';r.room.result={target:7};
 await g.start(r,h,7);assert.equal(r.room.targetRound,2);assert.equal(r.room.round,4);
});
test('ROUND-1 fixed countdown roster, reconnect, single choice, 2 second alarm',async()=>{
 const {g,r,h,p}=await setup();const b=await g.player(r,'b');await g.start(r,h,5,true);
 await g.command(r,p,{type:'select',value:2});assert.equal(r.room.players.p.value,null);
 const late=await g.player(r,'late');const lateState=r.publicStateFor(late.deserializeAttachment());assert.equal(lateState.phase,'choosing');assert.equal(lateState.round,1);assert.equal(lateState.countdownMode,true);assert.ok(lateState.countdownEndsAt);assert.equal(lateState.me.eligible,false);assert.equal(lateState.players.length,2);assert.equal(lateState.hasTarget,true);assert.equal(lateState.target,null);g.clock.now+=3001;await g.command(r,late,{type:'select',value:5});assert.equal(r.room.players.late.value,null);
 b.close();await r.webSocketClose(b,1000,'test');const state=r.publicStateFor(h.deserializeAttachment());assert.equal(state.players.find(x=>x.clientId==='b').online,false);assert.equal(state.players.length,2);
 await g.command(r,p,{type:'select',value:2});await g.command(r,p,{type:'select',value:4});assert.equal(r.room.players.p.value,2);assert.equal(r.room.autoRevealAt,null);
 const again=await g.connect(r,'b','player',g.secret,b.deserializeAttachment().resumeToken);await g.command(r,again,{type:'select',value:3});assert.equal(r.ctx.storage.alarm-g.clock.now,2000);
 h.close();g.clock.now+=2000;await r.alarm();assert.equal(r.room.result.sum,5);assert.equal(r.room.result.success,true);
});
test('TARGET-1 absent target produces neutral result and dash',async()=>{
 const {g,r,h,p}=await setup();await g.start(r,h,5);await g.command(r,h,{type:'setTarget',target:null});g.clock.now+=3001;await g.command(r,p,{type:'select',value:0});g.clock.now+=2000;await r.alarm();
 assert.equal(r.room.result.success,null);assert.equal(r.room.result.hasTarget,false);
 const e=client(),s=e.sockets[0];s.open();s.receive(e.state({phase:'reveal',hasTarget:false,result:r.room.result}));assert.ok(e.$('playerResult').innerHTML.includes('No target set'));assert.ok(e.$('playerResult').innerHTML.includes('>—</div>'));
});
test('INPUT-1 malformed objects, oversize payloads and coerced numbers are rejected',async()=>{
 const {g,r,h,p}=await setup();
 for(const raw of ['null','[]','"text"','{','{"type":"setTarget","target":3,"padding":"'+'x'.repeat(8200)+'"}']){await r.webSocketMessage(h,raw);assert.equal(h.messages.at(-1).type,'error');}
 for(const target of [null,'',true,'5']){await g.start(r,h,target);assert.equal(r.room.round,0);}
 await g.start(r,h,5);for(const value of [null,'',false,'3'])await g.command(r,p,{type:'select',value});assert.equal(r.room.players.p.value,null);
 for(const target of ['',false,'3'])await g.command(r,h,{type:'setTarget',target});assert.equal(r.room.target,5);
 await g.command(r,h,{type:'setTargetVisible',visible:'false'});assert.equal(r.room.targetVisible,false);
});
test('ROOM-1 lifetime history does not consume the 64 active slots; retention stays bounded',async()=>{
 const {g,r}=await setup();for(let i=0;i<270;i++){const s=await g.player(r,'past'+i);assert.equal(s.messages.at(-1).type,'state');s.close();await r.webSocketClose(s,1000,'left');g.clock.now++;}
 assert.ok(Object.keys(r.room.players).length<=256);
 for(let i=0;i<63;i++)await g.player(r,'active'+i);
 const full=await g.player(r,'extra');assert.equal(full.messages.at(-1).message,'Room is full');assert.equal(r.getActivePlayerIds().size,64);
});
