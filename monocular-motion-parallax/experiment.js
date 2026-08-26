import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createExperimentMode({world,trialEngine,getParameters=()=>({}),onTrial=()=>{},onState=()=>{}}={}){
  const {renderer,camera}=world;
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let active=false;
  let sessionId=null;
  let trialNo=0;
  let currentRatio=.06;
  let correctStreak=0;
  let lastDirection=null;
  let reversals=[];
  let correct=0,wrong=0,uncertainCount=0;
  const MIN_RATIO=.002,MAX_RATIO=.30,STEP_FACTOR=1.22;

  function makeId(prefix='exp'){
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  }

  function thresholdEstimate(){
    if(reversals.length<4)return null;
    const xs=reversals.slice(-8).map(x=>x.ratio).filter(x=>x>0);
    if(!xs.length)return null;
    return Math.exp(xs.reduce((s,x)=>s+Math.log(x),0)/xs.length);
  }

  function publish(){
    const total=correct+wrong+uncertainCount;
    onState({
      active,sessionId,trialNo,currentRatio,
      correct,wrong,uncertain:uncertainCount,total,
      accuracy:correct+wrong?correct/(correct+wrong):null,
      reversalCount:reversals.length,
      threshold80:thresholdEstimate()
    });
  }

  function startTrial(){
    if(!active)return;
    trialNo++;
    world.buildExperimentScene(currentRatio,{count:10});
    trialEngine.reset();
    trialEngine.startStep();
    renderer.domElement.style.cursor='crosshair';
    publish();
  }

  function start(){
    active=true;
    sessionId=makeId();
    trialNo=0;currentRatio=.06;correctStreak=0;lastDirection=null;reversals=[];
    correct=0;wrong=0;uncertainCount=0;
    startTrial();
    return sessionId;
  }

  function stop(){
    active=false;
    renderer.domElement.style.cursor='default';
    publish();
  }

  function isActive(){return active;}

  function objectScreenInfo(mesh,rect){
    const worldPos=mesh.getWorldPosition(new THREE.Vector3());
    const ndc=worldPos.clone().project(camera);
    const camP=worldPos.clone().applyMatrix4(camera.matrixWorldInverse);
    const depth=Math.max(.05,-camP.z);
    mesh.geometry.computeBoundingSphere();
    const radiusWorld=(mesh.geometry.boundingSphere?.radius||.35)*Math.max(mesh.scale.x,mesh.scale.y,mesh.scale.z);
    const pxPerWorld=rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth);
    return {ndc,x:(ndc.x*.5+.5)*rect.width,y:(-.5*ndc.y+.5)*rect.height,r:Math.max(5,radiusWorld*pxPerWorld)};
  }

  function forgivingPick(e){
    const objects=world.getObjects();
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
    pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera);
    const exact=raycaster.intersectObjects(objects,false)[0]?.object;
    if(exact)return exact;
    const px=e.clientX-rect.left,py=e.clientY-rect.top;
    let best=null,bestScore=Infinity;
    for(const o of objects){
      const s=objectScreenInfo(o,rect);
      if(s.ndc.z<-1||s.ndc.z>1)continue;
      const d=Math.hypot(px-s.x,py-s.y),hitR=Math.max(28,s.r*1.35+8);
      if(d<=hitR&&d/hitR<bestScore){bestScore=d/hitR;best=o;}
    }
    return best;
  }

  function updateStaircase(outcome){
    let direction=null;
    if(outcome==='correct'){
      correctStreak++;
      if(correctStreak>=3){
        correctStreak=0;
        currentRatio=clamp(currentRatio/STEP_FACTOR,MIN_RATIO,MAX_RATIO);
        direction='down';
      }
    }else{
      correctStreak=0;
      currentRatio=clamp(currentRatio*STEP_FACTOR,MIN_RATIO,MAX_RATIO);
      direction='up';
    }
    if(direction){
      if(lastDirection&&direction!==lastDirection)reversals.push({trialNo,ratio:currentRatio,direction});
      lastDirection=direction;
    }
  }

  function record(outcome,result,selected=null){
    const state=result?.state||trialEngine.getState();
    const snapshot=trialEngine.snapshot(state)||{};
    const record={
      trialId:`${sessionId}-t${trialNo}`,
      sessionId,
      timestamp:new Date().toISOString(),
      trialNo,
      outcome,
      correct:outcome==='correct',
      uncertain:outcome==='uncertain',
      selectedObjectId:selected?.uuid??null,
      objectCount:world.getObjects().length,
      responseTimeMs:result?.responseTimeMs??null,
      targetRelativeDelta:currentRatio,
      ...snapshot,
      staircase:{
        correctStreak,
        reversalCount:reversals.length,
        threshold80:thresholdEstimate()
      },
      ...getParameters()
    };
    onTrial(record);
    return record;
  }

  function complete(outcome,result,selected=null){
    if(outcome==='correct')correct++;
    else if(outcome==='wrong')wrong++;
    else uncertainCount++;
    record(outcome,result,selected);
    updateStaircase(outcome);
    startTrial();
  }

  function handlePointer(e){
    if(!active||e.button>0)return;
    const hit=forgivingPick(e);
    if(!hit)return;
    const result=trialEngine.choose(hit);
    if(result.type==='none'||result.type==='ignored')return;
    complete(result.type==='correct'?'correct':'wrong',result,hit);
  }

  function answerUncertain(){
    if(!active)return;
    const result=trialEngine.uncertain();
    if(result.type==='none')return;
    complete('uncertain',result,null);
  }

  renderer.domElement.addEventListener('pointerup',handlePointer);

  return {
    start,stop,isActive,answerUncertain,
    getSessionId:()=>sessionId,
    getState:()=>({active,sessionId,trialNo,currentRatio,correct,wrong,uncertain:uncertainCount,reversals:[...reversals],threshold80:thresholdEstimate()})
  };
}
