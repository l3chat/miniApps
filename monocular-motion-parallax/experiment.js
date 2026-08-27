import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createExperimentMode({world,trialEngine,getParameters=()=>({}),onTrial=()=>{},onState=()=>{}}={}){
  const {renderer,camera}=world;
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();

  let active=false;
  let sessionId=null;
  let sceneNo=0;
  let trialNo=0;
  let sceneStepNo=0;
  let currentRatio=.06;
  let lastDirection=null;
  let reversals=[];
  let correct=0,wrong=0,uncertainCount=0;
  let stepWrongCount=0;
  let sceneResolvedSteps=0;
  let sceneFirstTryCorrect=0;
  let sceneUncertain=0;
  let sceneWrongClicks=0;

  const MIN_RATIO=.002,MAX_RATIO=.30,SCENE_STEP_FACTOR=1.15;

  function makeId(prefix='exp'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  function thresholdEstimate(){
    if(reversals.length<4)return null;
    const xs=reversals.slice(-8).map(x=>x.ratio).filter(x=>x>0);
    return xs.length?Math.exp(xs.reduce((s,x)=>s+Math.log(x),0)/xs.length):null;
  }
  function publish(){
    const total=correct+wrong+uncertainCount;
    onState({active,sessionId,sceneNo,trialNo,currentRatio,correct,wrong,uncertain:uncertainCount,total,accuracy:correct+wrong?correct/(correct+wrong):null,reversalCount:reversals.length,threshold80:thresholdEstimate(),objectsRemaining:world.getObjects().length});
  }

  function startStep(){
    if(!active)return;
    if(world.getObjects().length<=1){finishScene();return;}
    trialNo++;
    sceneStepNo++;
    stepWrongCount=0;
    trialEngine.reset();
    trialEngine.startStep();
    renderer.domElement.style.cursor='crosshair';
    publish();
  }

  function startScene(){
    if(!active)return;
    sceneNo++;
    sceneStepNo=0;
    sceneResolvedSteps=0;
    sceneFirstTryCorrect=0;
    sceneUncertain=0;
    sceneWrongClicks=0;
    world.buildExperimentScene(currentRatio,{count:10});
    startStep();
  }

  function updateDifficultyAfterScene(){
    const resolved=Math.max(1,sceneResolvedSteps);
    const firstTryAccuracy=sceneFirstTryCorrect/resolved;
    const uncertainRate=sceneUncertain/resolved;
    let direction=null;

    if(firstTryAccuracy>=.80&&uncertainRate===0){
      currentRatio=clamp(currentRatio/SCENE_STEP_FACTOR,MIN_RATIO,MAX_RATIO);
      direction='down';
    }else if(firstTryAccuracy<.65||uncertainRate>=.20){
      currentRatio=clamp(currentRatio*SCENE_STEP_FACTOR,MIN_RATIO,MAX_RATIO);
      direction='up';
    }

    if(direction){
      if(lastDirection&&direction!==lastDirection)reversals.push({sceneNo,trialNo,ratio:currentRatio,direction});
      lastDirection=direction;
    }
  }

  function finishScene(){
    if(!active)return;
    updateDifficultyAfterScene();
    startScene();
  }

  function start(){
    active=true;
    sessionId=makeId();
    sceneNo=0;trialNo=0;sceneStepNo=0;currentRatio=.06;lastDirection=null;reversals=[];
    correct=0;wrong=0;uncertainCount=0;
    startScene();
    return sessionId;
  }

  function stop(){active=false;renderer.domElement.style.cursor='default';publish();}
  function isActive(){return active;}

  function pickExact(e){
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
    pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(world.getObjects(),false)[0]?.object||null;
  }

  function record(outcome,result,selected=null){
    const snapshot=trialEngine.snapshot(result?.state||trialEngine.getState())||{};
    const rec={
      trialId:`${sessionId}-t${trialNo}-${wrong+correct+uncertainCount+1}`,
      sessionId,
      timestamp:new Date().toISOString(),
      sceneNo,
      sceneStepNo,
      trialNo,
      attemptInStep:stepWrongCount+1,
      outcome,
      correct:outcome==='correct',
      uncertain:outcome==='uncertain',
      selectedObjectId:selected?.uuid??null,
      objectCount:world.getObjects().length,
      responseTimeMs:result?.responseTimeMs??null,
      targetRelativeDelta:currentRatio,
      ...snapshot,
      sceneState:{resolvedSteps:sceneResolvedSteps,firstTryCorrect:sceneFirstTryCorrect,uncertain:sceneUncertain,wrongClicks:sceneWrongClicks},
      staircase:{reversalCount:reversals.length,threshold80:thresholdEstimate()},
      ...getParameters()
    };
    onTrial(rec);
    return rec;
  }

  function advanceAfterRemovingNearest(){
    trialEngine.reset();
    if(world.getObjects().length<=1)finishScene();
    else startStep();
  }

  function handlePointer(e){
    if(!active||e.button>0)return;
    const hit=pickExact(e);
    if(!hit)return;

    const result=trialEngine.choose(hit);
    if(result.type==='none'||result.type==='ignored')return;

    if(result.type==='wrong'){
      wrong++;
      sceneWrongClicks++;
      record('wrong',result,hit);
      stepWrongCount++;
      publish();
      return;
    }

    if(result.type==='correct'){
      correct++;
      sceneResolvedSteps++;
      if(stepWrongCount===0)sceneFirstTryCorrect++;
      record('correct',result,hit);
      world.removeObject(hit);
      advanceAfterRemovingNearest();
    }
  }

  function answerUncertain(){
    if(!active)return;
    const state=trialEngine.getState()||trialEngine.startStep();
    const nearest=state?.nearest;
    if(!nearest)return;

    const result=trialEngine.uncertain();
    if(result.type==='none')return;

    uncertainCount++;
    sceneResolvedSteps++;
    sceneUncertain++;
    record('uncertain',result,null);

    // "Не уверен" deliberately skips the current discrimination step:
    // remove the true nearest object silently and continue ranking the same scene.
    world.removeObject(nearest);
    advanceAfterRemovingNearest();
  }

  renderer.domElement.addEventListener('pointerup',handlePointer);

  return {
    start,stop,isActive,answerUncertain,
    getSessionId:()=>sessionId,
    getState:()=>({active,sessionId,sceneNo,trialNo,currentRatio,correct,wrong,uncertain:uncertainCount,reversals:[...reversals],threshold80:thresholdEstimate(),objectsRemaining:world.getObjects().length})
  };
}
