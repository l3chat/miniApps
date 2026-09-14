import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapper} from './client-adapter.mjs';
import {loadGame} from './server-adapter.mjs';
test('ZOOM-2 room association appearing after launch is found',async()=>{const e=await wrapper();e.setLookup('ABC234');await e.tick(12000);assert.ok(e.calls.lookup>1);assert.ok(e.frame.contentWindow.location.href.includes('room=ABC234'));assert.equal(e.enterClicks,1)});
test('ZOOM-3 missing meeting context is retried with a bound',async()=>{const e=await wrapper({uuidFails:true});await e.tick(12000);assert.ok(e.calls.uuid>1);await e.tick(300000);assert.ok(e.calls.uuid<=6);assert.equal(e.calls.lookup,0)});
test('ZOOM-4 restored host is not automatically joined as player',async()=>{const e=await wrapper({lookup:'ABC234',stored:{'zoomSumGameHost:ABC234':'local-audit-host-secret-0123456789'}});await e.tick(1200);assert.equal(e.enterClicks,0)});
test('ZOOM-1 permanent conflict stops retries',async()=>{const e=await wrapper({lookup:'ABC234',bindStatus:409});e.frame.contentWindow.location.href='https://audit.local/zoom-sum-game/?room=DEF234&host=local-audit-host-secret-0123456789';await e.tick(60000);assert.equal(e.calls.bind,1);assert.equal(e.calls.notice,'meetingConflict')});
test('ZOOM-1 owner can replace association, another room owner cannot',async()=>{
 const g=await loadGame();await g.room('ABC234');await g.room('DEF234');
 const bind=body=>g.worker.fetch(new Request('https://audit.local/zoom-sum-game/api/zoom-meeting-room',{method:'POST',body:JSON.stringify({meetingUUID:'meeting',hostSecret:g.secret,...body})}),g.env);
 assert.equal((await bind({room:'ABC234'})).status,204);
 assert.equal((await bind({room:'DEF234',previousRoom:'ABC234',previousHostSecret:'wrong'})).status,403);
 assert.equal((await bind({room:'DEF234',previousRoom:'ABC234',previousHostSecret:g.secret})).status,204);
 const res=await g.worker.fetch(new Request('https://audit.local/zoom-sum-game/api/zoom-meeting-room?meetingUUID=meeting'),g.env);assert.equal((await res.json()).room,'DEF234');
});
test('ZOOM-1 atomic compare prevents a stale association overwrite',async()=>{
 const g=await loadGame(),r=g.actor('zoom-meeting:race');
 const put=(room,expectedRoom)=>r.fetch(new Request('https://room.internal/meeting-link',{method:'PUT',body:JSON.stringify({room,expectedRoom,expiresAt:g.clock.now+100000})}));
 const results=await Promise.all([put('ABC234',null),put('DEF234',null)]);assert.deepEqual(results.map(x=>x.status).sort(),[204,409]);
});
test('OAUTH-1 correlated callback succeeds; invalid state never exchanges code',async()=>{
 const g=await loadGame(),env={...g.env,ZOOM_CLIENT_ID:'test-client',ZOOM_CLIENT_SECRET:'test-secret'};
 const run=(path,headers={})=>g.worker.fetch(new Request('https://audit.local/zoom-sum-game/oauth/'+path,{headers}),env);
 const start=await run('start'),cookie=start.headers.get('set-cookie').split(';')[0],state=new URL(start.headers.get('location')).searchParams.get('state');
 assert.ok(cookie.endsWith(state));assert.equal((await run('callback?code=test&state='+state,{cookie})).status,200);assert.equal(g.requests.length,1);
 for(const [query,c] of [['code=test&state=wrong',cookie],['code=test',cookie],['code=test&state='+state,''],['code=test&state=x','zoom_sum_oauth_state=%invalid']])assert.equal((await run('callback?'+query,{cookie:c})).status,400);
 assert.equal(g.requests.length,1);
});
test('OAUTH-1 Marketplace callback without state starts a fresh correlated flow',async()=>{
 const g=await loadGame(),env={...g.env,ZOOM_CLIENT_ID:'test-client',ZOOM_CLIENT_SECRET:'test-secret'};
 const res=await g.worker.fetch(new Request('https://audit.local/zoom-sum-game/oauth/callback?code=marketplace'),env);
 assert.equal(res.status,302);assert.ok(new URL(res.headers.get('location')).searchParams.get('state'));assert.ok(res.headers.get('set-cookie'));assert.equal(g.requests.length,0);
});
test('ZOOM-3 context change reconfigures SDK without silently moving a joined participant',async()=>{
 const e=await wrapper({lookup:'ABC234'});await e.tick(1200);const oldUrl=e.frame.contentWindow.location.href;e.setLookup('DEF234');await e.changeMeeting('another-meeting');await e.tick(2400);
 assert.ok(e.calls.config>=2);assert.equal(e.frame.contentWindow.location.href,oldUrl);assert.equal(e.calls.notice,'meetingChanged');
});
test('ZOOM-3 transient UUID error recovers to automatic entry',async()=>{
 const e=await wrapper({uuidFails:true,lookup:'ABC234'});e.setUuidFailure(false);await e.tick(12000);assert.equal(e.enterClicks,1);assert.ok(e.frame.contentWindow.location.href.includes('room=ABC234'));
});
test('ZOOM-2 manual exit leaves landing available for creation of a replacement room',async()=>{
 const e=await wrapper({lookup:'ABC234'});await e.tick(1200);e.frame.contentWindow.location.href='https://audit.local/zoom-sum-game/index.html';await e.tick(12000);assert.ok(!e.frame.contentWindow.location.href.includes('room='));
});
