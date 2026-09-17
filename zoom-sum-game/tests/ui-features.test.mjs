import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {client} from './client-adapter.mjs';

test('Copy notification disappears after 2.5 seconds',async()=>{
  const e=client({host:true});
  await e.$('copyLink').click();
  assert.equal(e.$('message').textContent,'Link copied');
  assert.equal(e.$('message').classList.contains('hidden'),false);
  assert.ok(e.context.copiedText.includes('room=ABC234'));
  await e.tick(2499);
  assert.equal(e.$('message').classList.contains('hidden'),false);
  await e.tick(2);
  assert.equal(e.$('message').classList.contains('hidden'),true);
});

test('French and Greek localizations contain every English key',()=>{
  for(const language of ['fr','el']){
    const e=client({stored:{zoomSumGameLang:language}});
    assert.deepEqual(Object.keys(e.context.__I18N[language]).sort(),Object.keys(e.context.__I18N.en).sort());
    assert.notEqual(e.$('createBtn').textContent,'Create room');
  }
});

test('Successful Russian result says Есть',()=>{
  const e=client({stored:{zoomSumGameLang:'ru'}}),socket=e.sockets[0];
  socket.open();
  socket.receive(e.state({phase:'reveal',countdownMode:true,result:{hasTarget:true,target:5,sum:5,success:true,players:[]}}));
  assert.ok(e.$('playerResult').innerHTML.includes('Есть!'));
});

test('Participant lists are expanded by default',()=>{
  const host=client({host:true});
  const details=host.document.all.filter(element=>element.tagName==='DETAILS');
  assert.ok(details.filter(element=>element.getAttribute('open')!==null).length>=2);
  assert.ok(details.some(element=>element.classList.contains('roundRoster')&&element.getAttribute('open')!==null));
});

test('Waiting and late participants see current round data and roster',()=>{
  const waiting=client(),waitingSocket=waiting.sockets[0];waitingSocket.open();
  waitingSocket.receive(waiting.state({phase:'setup',countdownMode:true,players:[{clientId:'a',name:'Alpha',chosen:false,online:true}]}));
  assert.ok(waiting.$('playerPlayers').innerHTML.includes('Alpha'));
  assert.equal(waiting.$('roundInfo').textContent,'waiting for round');

  const late=client(),lateSocket=late.sockets[0];lateSocket.open();
  lateSocket.receive(late.state({round:7,countdownMode:true,targetVisible:true,liveTarget:9,target:9,countdownEndsAt:late.clock.now-1,players:[{clientId:'a',name:'Alpha',chosen:true,online:true}],me:{name:'Late',value:null,ready:false,eligible:false}}));
  assert.equal(late.$('roundInfo').textContent,'round 7');
  assert.equal(late.$('targetDisplay').textContent,9);
  assert.ok(late.$('playerHint').textContent.includes('joined after'));
  assert.ok(late.$('playerPlayers').innerHTML.includes('Alpha'));
});

test('Host-only controls and host play area have distinct color themes',async()=>{
  const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/\.hostControls>\.card.*#7c3aed/);
  assert.match(html,/\.hostPlay\{background:color-mix\(in srgb,#0f766e/);
  assert.match(html,/\.hostControls>details \.players\{max-height:22dvh;overflow:auto\}/);
});

test('leChat copyright is visible in the persistent header',async()=>{
  const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<header><div class="brandline">.*<span class="copyright">© leChat<\/span>/);
  assert.match(html,/\.copyright\{font-size:/);
});
