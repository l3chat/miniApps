import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createTrainingMode({world,trialEngine,onScore=()=>{},onWin=()=>{},onSessionEnd=()=>{},maxErrors=3}){
  const {renderer,camera}=world;
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  const tweens=new Map();
  let active=false;
  let correct=0,wrong=0,unresolved=0;
  let sessionStartedAt=null,sessionId=null,sessionFinished=true;

  function makeId(){return `train-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  function score(){const n=correct+wrong;return n?Math.round(correct/n*100):100;}
  function snapshot(){return {sessionId,correct,wrong,unresolved,score:score(),active,startedAt:sessionStartedAt};}
  function publish(){onScore(snapshot());}
  function resetStats(){correct=0;wrong=0;unresolved=0;publish();}
  function finishSession(reason){if(sessionFinished||!sessionId)return;sessionFinished=true;const endedAt=new Date().toISOString();const durationSec=sessionStartedAt?Math.max(0,(Date.now()-new Date(sessionStartedAt).getTime())/1000):0;onSessionEnd({...snapshot(),active:false,reason,endedAt,durationSec});}

  function objectScreenInfo(mesh,rect,positionOverride=null){
    const worldPos=positionOverride?positionOverride.clone():mesh.getWorldPosition(new THREE.Vector3());const ndc=worldPos.clone().project(camera);const camP=worldPos.clone().applyMatrix4(camera.matrixWorldInverse);const depth=Math.max(.03,-camP.z);mesh.geometry.computeBoundingSphere();const radiusWorld=(mesh.geometry.boundingSphere?.radius||.35)*Math.max(mesh.scale.x,mesh.scale.y,mesh.scale.z);const pxPerWorld=rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth);return {ndc,x:(ndc.x*.5+.5)*rect.width,y:(-.5*ndc.y+.5)*rect.height,r:Math.max(5,radiusWorld*pxPerWorld),world:worldPos};
  }
  function forgivingPick(e){
    const objects=world.getObjects(),rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const exact=raycaster.intersectObjects(objects,false)[0]?.object;if(exact)return exact;const px=e.clientX-rect.left,py=e.clientY-rect.top;let best=null,bestScore=Infinity;for(const o of objects){const s=objectScreenInfo(o,rect);if(s.ndc.z<-1||s.ndc.z>1)continue;const d=Math.hypot(px-s.x,py-s.y),hitR=Math.max(22,s.r*1.25+6);if(d<=hitR&&d/hitR<bestScore){bestScore=d/hitR;best=o;}}return best;
  }
  function rayPointForNdcAtDistance(ndcX,ndcY,distance){const p=new THREE.Vector3(ndcX,ndcY,.5).unproject(camera),dir=p.sub(camera.position).normalize();return camera.position.clone().add(dir.multiplyScalar(distance));}
  function candidateFree(mesh,candidate,rect){const a=objectScreenInfo(mesh,rect,candidate);if(Math.abs(a.ndc.x)>.96||Math.abs(a.ndc.y)>.94)return false;for(const o of world.getObjects()){if(o===mesh)continue;const b=objectScreenInfo(o,rect);if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+10)return false;}return true;}
  function moveWrongTowardCenter(mesh){const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return;const info=objectScreenInfo(mesh,rect),distance=camera.position.distanceTo(info.world),yNdc=clamp(info.ndc.y,-.88,.88),candidates=[0];for(let d=.04;d<=.92;d+=.04)candidates.push(d,-d);let target=null;for(const xNdc of candidates){const c=rayPointForNdcAtDistance(xNdc,yNdc,distance);if(candidateFree(mesh,c,rect)){target=c;break;}}if(!target)return;tweens.set(mesh,{from:mesh.position.clone(),to:target,start:performance.now(),duration:380});}
  function markWrong(mesh){world.disposeMaterial(mesh.material);mesh.material=world.makePatternMaterial(0xff2020,.42,0,'checker');const item=world.itemFor(mesh);if(item)item.excluded=true;moveWrongTowardCenter(mesh);}
  function moveNearestTowardCamera(mesh,factor=.8){
    if(!mesh?.parent)return;const p=mesh.getWorldPosition(new THREE.Vector3()),ray=p.clone().sub(camera.position),distance=ray.length();if(distance<=.08)return;const targetDistance=Math.max(.08,distance*factor),ratio=targetDistance/distance,target=camera.position.clone().add(ray.normalize().multiplyScalar(targetDistance));tweens.set(mesh,{from:mesh.position.clone(),to:target,scaleFrom:mesh.scale.clone(),scaleTo:mesh.scale.clone().multiplyScalar(ratio),start:performance.now(),duration:420});
  }
  function updateTweens(now){for(const [mesh,t] of tweens){if(!mesh.parent){tweens.delete(mesh);continue;}const u=clamp((now-t.start)/t.duration,0,1),s=u*u*(3-2*u);mesh.position.lerpVectors(t.from,t.to,s);if(t.scaleFrom)mesh.scale.lerpVectors(t.scaleFrom,t.scaleTo,s);if(u>=1)tweens.delete(mesh);}}
  function start(){if(active)finishSession('restarted');active=true;sessionId=makeId();sessionStartedAt=new Date().toISOString();sessionFinished=false;resetStats();trialEngine.reset();trialEngine.startStep();renderer.domElement.style.cursor='crosshair';publish();}
  function stop(reason='stopped'){if(!active){finishSession(reason);return;}active=false;renderer.domElement.style.cursor='default';publish();finishSession(reason);}
  function isActive(){return active;}
  function handlePointer(e){
    if(!active||e.button>0)return;const hit=forgivingPick(e);if(!hit)return;const result=trialEngine.choose(hit);if(result.type==='ignored'||result.type==='none')return;
    if(result.type==='correct'){correct++;world.removeObject(hit);if(world.getObjects().length===0){active=false;renderer.domElement.style.cursor='default';publish();const final=snapshot();onWin(final);finishSession('won');return;}trialEngine.startStep();publish();return;}
    if(result.type==='wrong'){wrong++;markWrong(hit);const cueFactor=result.errorCount===1?.80:result.errorCount===2?.70:.62;moveNearestTowardCamera(result.nearest,cueFactor);if(result.errorCount>=maxErrors){unresolved++;trialEngine.markUnresolved();world.buildScene();trialEngine.reset();trialEngine.startStep();}publish();}
  }
  renderer.domElement.addEventListener('pointerup',handlePointer);
  return {start,stop,isActive,resetStats,updateTweens,getStats:()=>snapshot()};
}
