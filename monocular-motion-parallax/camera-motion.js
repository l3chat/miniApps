import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export function createCameraMotion(camera,onUpdate=()=>{}){
  const params={
    mode:'static',
    baselineCm:8,
    frequency:1.6,
    focusDistance:8,
    waveform:'sine',
    paused:false
  };

  const wave=p=>params.waveform==='triangle'
    ? (((p%=1)<.5)?p*2:2-p*2)
    : .5-.5*Math.cos(p*Math.PI*2);

  function viewAt(t){
    const p=t*params.frequency;
    if(params.mode==='static')return .5;
    if(params.mode==='continuous')return wave(p);
    if(params.mode==='lr')return Math.floor(p*2)%2?1:0;
    const steps=[0,.25,.5,.75,1,.75,.5,.25];
    return steps[Math.floor(p*8)%steps.length];
  }

  function update(t,focusOverride=null){
    const x=(viewAt(t)-.5)*params.baselineCm/100;
    camera.position.x=x;
    const focusDistance=focusOverride??params.focusDistance;
    camera.lookAt(new THREE.Vector3(0,camera.position.y,camera.position.z-focusDistance));
    onUpdate({xCm:x*100,focusDistance});
  }

  function set(key,value){
    if(key in params)params[key]=value;
  }

  function reset(){
    Object.assign(params,{mode:'static',baselineCm:8,frequency:1.6,focusDistance:8,waveform:'sine',paused:false});
  }

  return {params,update,set,reset,viewAt};
}
