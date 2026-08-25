import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { I18N } from './i18n.js';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const rand = (a,b) => a + Math.random()*(b-a);
const pick = a => a[Math.floor(Math.random()*a.length)];

function detectLang(){
  const saved=localStorage.getItem('mmp-language');
  if(saved && I18N[saved]) return saved;
  const n=(navigator.language||'').toLowerCase();
  for(const l of ['ru','de','uk','fr','en']) if(n.startsWith(l)) return l;
  return 'ru';
}
let lang=detectLang();
const tr=k=>I18N[lang]?.[k] ?? I18N.en[k] ?? k;

let params={mode:'static',baselineCm:8,frequency:1.6,focusDistance:8,waveform:'sine',sceneDepth:2.4,paused:false};
let objects=[], demoItems=[];

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;
$('app').appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x09101d,10,34);
const camera=new THREE.PerspectiveCamera(55,1,.05,80);
camera.position.set(0,1.55,5.8);
const group=new THREE.Group();
scene.add(group);

const hemi=new THREE.HemisphereLight(0xdde8ff,0x20304a,1.7);
const key=new THREE.DirectionalLight(0xffffff,2.6);
const rim=new THREE.PointLight(0x68a8ff,12,15);
key.position.set(3,6,4); key.castShadow=true;
rim.position.set(-3,2.5,-1);
scene.add(hemi,key,rim);

const floor=new THREE.Mesh(
  new THREE.PlaneGeometry(28,40),
  new THREE.MeshStandardMaterial({color:0x111a2d,roughness:.82,metalness:.05,transparent:true,opacity:.12,depthWrite:false})
);
floor.rotation.x=-Math.PI/2; floor.position.set(0,0,-8); scene.add(floor);
const grid=new THREE.GridHelper(28,56,0x315074,0x22334b);
grid.position.set(0,.006,-8);
for(const m of (Array.isArray(grid.material)?grid.material:[grid.material])){m.transparent=true;m.opacity=.28;m.depthWrite=false;}
scene.add(grid);

const FAR_GRID_Z=-24.2, FAR_GRID_SIZE=120, FAR_GRID_DIVISIONS=40;
const farWall=new THREE.Mesh(new THREE.PlaneGeometry(FAR_GRID_SIZE,FAR_GRID_SIZE),new THREE.MeshBasicMaterial({color:0x07101e,side:THREE.DoubleSide,fog:false}));
farWall.position.set(0,6,FAR_GRID_Z-.03); scene.add(farWall);
const farGrid=new THREE.GridHelper(FAR_GRID_SIZE,FAR_GRID_DIVISIONS,0xc1d8ff,0x5d8fca);
farGrid.rotation.x=Math.PI/2; farGrid.position.set(0,6,FAR_GRID_Z);
for(const m of (Array.isArray(farGrid.material)?farGrid.material:[farGrid.material])){m.fog=false;m.transparent=true;m.opacity=.96;m.depthWrite=false;}
farGrid.renderOrder=1; scene.add(farGrid);
for(let i=0;i<11;i++){
  const m=new THREE.Mesh(new THREE.BoxGeometry(7.5,.018,.02),new THREE.MeshBasicMaterial({color:0x27415f,transparent:true,opacity:.42}));
  m.position.set(0,.015,.5-i*1.35); scene.add(m);
}

const colors=[0xff7a85,0x78c7ff,0x8ee0b1,0xf6c86b,0xb89cff,0xffa66f,0x72e2ef,0xf08cc8,0xa8df65];
const shapes=['sphere','box','torus','cone','cylinder','dodeca','octa','knot'];
const patternKinds=['squares','triangles','checker'];

function colorCss(hex){return `#${new THREE.Color(hex).getHexString()}`;}
function contrastCss(hex){const c=new THREE.Color(hex);const L=.2126*c.r+.7152*c.g+.0722*c.b;return L>.46?'#10141d':'#ffffff';}
function makePatternTexture(baseColor,kind=pick(patternKinds)){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d'); x.fillStyle=colorCss(baseColor); x.fillRect(0,0,128,128); x.fillStyle=contrastCss(baseColor);
  if(kind==='squares'){
    for(let j=0;j<4;j++) for(let i=0;i<4;i++) x.fillRect(i*32+9,j*32+9,14,14);
  }else if(kind==='triangles'){
    for(let j=0;j<4;j++) for(let i=0;i<4;i++){
      const cx=i*32+16,cy=j*32+16,r=11; x.beginPath();
      if((i+j)%2===0){x.moveTo(cx,cy-r);x.lineTo(cx-r,cy+r);x.lineTo(cx+r,cy+r);}else{x.moveTo(cx,cy+r);x.lineTo(cx-r,cy-r);x.lineTo(cx+r,cy-r);} x.closePath();x.fill();
    }
  }else{
    for(let j=0;j<4;j++) for(let i=0;i<4;i++) if((i+j)%2===0) x.fillRect(i*32,j*32,32,32);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.8,1.8); t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return t;
}
function makePatternMaterial(color,rough=.4,metal=.05,kind){return new THREE.MeshStandardMaterial({color:0xffffff,map:makePatternTexture(color,kind),roughness:rough,metalness:metal});}
function disposeMaterial(mat){for(const m of (Array.isArray(mat)?mat:[mat])){if(!m)continue;m.map?.dispose();m.dispose?.();}}
function geo(t){
  if(t==='sphere') return new THREE.SphereGeometry(.34,40,28);
  if(t==='box') return new THREE.BoxGeometry(.58,.58,.58);
  if(t==='torus') return new THREE.TorusGeometry(.28,.10,18,48);
  if(t==='cone') return new THREE.ConeGeometry(.35,.72,32);
  if(t==='cylinder') return new THREE.CylinderGeometry(.27,.34,.68,32);
  if(t==='dodeca') return new THREE.DodecahedronGeometry(.36);
  if(t==='octa') return new THREE.OctahedronGeometry(.40);
  return new THREE.TorusKnotGeometry(.23,.075,80,12);
}

function clearGroup(){
  group.traverse(o=>{o.geometry?.dispose();disposeMaterial(o.material);});
  group.clear(); objects=[]; demoItems=[]; gameTweens.clear();
}
function addDemo(type,xT,y,depthT,scale,color,support=false){
  const g=geo(type); g.computeBoundingSphere();
  const m=new THREE.Mesh(g,makePatternMaterial(color,.28+Math.random()*.42,Math.random()*.2));
  m.position.set(0,y,0);m.scale.setScalar(scale);m.rotation.set(Math.random()*.7,Math.random()*Math.PI*2,Math.random()*.4);m.castShadow=m.receiveShadow=true;
  group.add(m);objects.push(m);
  let p=null;
  if(support){p=new THREE.Mesh(new THREE.CylinderGeometry(.38,.48,.12,28),new THREE.MeshStandardMaterial({color:0x283750,roughness:.72}));p.position.set(0,.06,0);group.add(p);}
  demoItems.push({mesh:m,support:p,depthT,xT,manual:false});
}
function layoutDemoScene(){
  const span=Math.max(.5,params.sceneDepth)*3.6;
  const tanHalf=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
  for(const o of demoItems){
    if(o.manual) continue;
    const z=.6-o.depthT*span, distance=Math.max(.5,camera.position.z-z);
    const halfW=tanHalf*distance*camera.aspect;
    const radius=(o.mesh.geometry.boundingSphere?.radius||.4)*o.mesh.scale.x;
    const x=o.xT*Math.max(.25,halfW*.96-radius*.8);
    o.mesh.position.set(x,o.mesh.position.y,z);
    if(o.support)o.support.position.set(x,.06,z);
  }
}
function buildScene(){
  clearGroup();
  const style=pick(['gallery','floating','corridor','constellation']);
  const bg={gallery:0x09101d,floating:0x07141a,corridor:0x120d1b,constellation:0x070b16};
  scene.background=new THREE.Color(bg[style]);
  floor.material.color.setHex(style==='corridor'?0x1a1324:style==='floating'?0x0c1a1d:0x111a2d);
  grid.visible=style==='gallery'||style==='corridor';
  rim.position.set(rand(-5,5),rand(1.8,4.4),rand(-5,0)); key.position.set(rand(-6,6),rand(4.5,8),rand(2,7));
  const n=16+Math.floor(Math.random()*10);
  for(let i=0;i<n;i++){
    const d=n===1?0:i/(n-1); let xT,y,s,sup=false;
    if(style==='gallery'){xT=rand(-.98,.98);y=rand(.35,3.25);s=rand(.42,1.08);sup=y<.82&&Math.random()<.45;}
    else if(style==='floating'){xT=rand(-.99,.99);y=rand(.2,4.1);s=rand(.34,1.02);}
    else if(style==='corridor'){xT=(i%2?-1:1)*rand(.48,.99);y=rand(.25,3.45);s=rand(.38,1);sup=Math.random()<.2;}
    else{xT=rand(-.995,.995);y=rand(.15,4.5);s=rand(.28,.94);}
    addDemo(pick(shapes),xT,y,d,s,pick(colors),sup);
  }
  if(gameActive) resetGameStats();
  layoutDemoScene();
}

function fitViewer(){
  const r=$('viewer').getBoundingClientRect(); if(!r.width||!r.height)return;
  camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);layoutDemoScene();
}
new ResizeObserver(fitViewer).observe($('viewer'));

let elapsed=0,last=performance.now(),fpsSmooth=60;
const wave=p=>params.waveform==='triangle'?(((p%=1)<.5)?p*2:2-p*2):.5-.5*Math.cos(p*Math.PI*2);
function view(t){const p=t*params.frequency;if(params.mode==='static')return .5;if(params.mode==='continuous')return wave(p);if(params.mode==='lr')return Math.floor(p*2)%2?1:0;const a=[0,.25,.5,.75,1,.75,.5,.25];return a[Math.floor(p*8)%a.length];}

let testActive=false,trials=[],trial=null,testObjects=[],testRatio=.05;
const RMIN=.001,RMAX=.3,OK=.96,ERR=1.18,ZMIN=2.5,ZMAX=8;
function currentFocusDistance(){if(testActive&&$('testAutoFocus')?.checked&&trial)return trial.meanDistance;return params.focusDistance;}
function updateCamera(t){const x=(view(t)-.5)*params.baselineCm/100;camera.position.x=x;const F=currentFocusDistance();camera.lookAt(new THREE.Vector3(0,camera.position.y,camera.position.z-F));$('camx').textContent=(x*100).toFixed(1);$('focusHud').textContent=F.toFixed(1);}
function clearTest(){for(const o of testObjects){scene.remove(o);o.geometry.dispose();disposeMaterial(o.material);}testObjects=[];}
function randZ(){return Math.exp(Math.log(ZMIN)+Math.random()*(Math.log(ZMAX)-Math.log(ZMIN)));}
function syncRatio(){$('testRatio').value=testRatio*100;$('testRatioVal').textContent=(testRatio*100).toFixed(1);}
function makeTestObject(type,x,y,z,color,distance,ang){const g=geo(type);g.computeBoundingSphere();const scale=Math.tan(ang)*distance/Math.max(g.boundingSphere?.radius||.35,.001);const m=new THREE.Mesh(g,makePatternMaterial(color,.3+Math.random()*.25,Math.random()*.12));m.position.set(x,y,z);m.scale.setScalar(scale);m.rotation.set(Math.random()*.7,Math.random()*Math.PI*2,Math.random()*.5);scene.add(m);testObjects.push(m);}
function testHorizontalX(distance,side){const halfW=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*distance*camera.aspect;return side*.40*halfW;}
function newTrial(){
  if(!testActive)return;clearTest();const Z=randZ(),r=clamp(testRatio,RMIN,RMAX),dz=r*Z,near=Math.random()<.5?'left':'right';const cz=camera.position.z-Z,zl=cz+(near==='left'?dz/2:-dz/2),zr=cz+(near==='right'?dz/2:-dz/2);
  const lt=pick(shapes);let rt=pick(shapes);if(Math.random()<.75)while(rt===lt)rt=pick(shapes);const lc=pick(colors);let rc=pick(colors);while(rc===lc)rc=pick(colors);
  const ang=rand(7.5,11.7)*Math.PI/180,nearD=Z-dz/2,farD=Z+dz/2,ld=near==='left'?nearD:farD,rd=near==='right'?nearD:farD;
  makeTestObject(lt,testHorizontalX(ld,-1),.95,zl,lc,ld,ang);makeTestObject(rt,testHorizontalX(rd,1),.95,zr,rc,rd,ang);
  trial={leftType:lt,rightType:rt,nearer:near,delta:dz,ratio:r,meanDistance:Z,focusDistance:$('testAutoFocus')?.checked?Z:params.focusDistance,mode:params.mode,baselineCm:params.baselineCm,frequency:params.frequency,waveform:params.waveform};updateTestState();
}
function answer(c){if(!trial)return;const ok=c===trial.nearer,before=testRatio;testRatio=clamp(testRatio*(ok?OK:ERR),RMIN,RMAX);trials.push({...trial,choice:c,correct:ok,ratioBefore:before,ratioAfter:testRatio,time:new Date().toISOString()});syncRatio();trial=null;updateScore();setTimeout(newTrial,120);}
function updateScore(){const n=trials.length,c=trials.filter(x=>x.correct).length,p=n?Math.round(c/n*100):0;$('score').textContent=`${tr('trials')}: ${n} · ${tr('correct')}: ${c} · ${p}%`;}
function updateTestState(){$('testState').textContent=trial?`${tr('adaptive')} · Z: ${trial.meanDistance.toFixed(2)} m · ΔZ: ${(trial.delta*100).toFixed(1)} cm · F: ${trial.focusDistance.toFixed(2)} m · ${tr('target')}`:`${tr('adaptive')} · Z: — · ΔZ: — · F: — · ${tr('target')}`;}
function setTest(on){if(on&&gameActive)setGame(false);testActive=on;$('testPanel').classList.toggle('show',on);group.visible=!on;if(on){syncRatio();newTrial();}else{clearTest();trial=null;updateTestState();}}

let gameActive=false,gameCorrect=0,gameWrong=0;
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(), tmpWorld=new THREE.Vector3();
const gameTweens=new Map();
function resetGameStats(){gameCorrect=0;gameWrong=0;updateGameScore();}
function updateGameScore(){const n=gameCorrect+gameWrong,p=n?Math.round(gameCorrect/n*100):100;if($('gameScore'))$('gameScore').textContent=`${p}%`;if($('gameStatus'))$('gameStatus').hidden=!gameActive;}
function updatePlayButton(){if($('playBtn'))$('playBtn').textContent=gameActive?tr('stopGame'):tr('play');}
function setGame(on){if(on&&testActive)setTest(false);if(on&&objects.length===0)buildScene();gameActive=on;$('playBtn')?.classList.toggle('active',on);renderer.domElement.style.cursor=on?'crosshair':'default';if(on)resetGameStats();else if($('gameStatus'))$('gameStatus').hidden=true;updatePlayButton();}
function nearestGameObject(){let best=null,bestD=Infinity;for(const o of objects){if(!o.parent||!o.visible)continue;o.getWorldPosition(tmpWorld);const d=camera.position.distanceTo(tmpWorld);if(d<bestD){bestD=d;best=o;}}return best;}
function removeGameObject(mesh){const item=demoItems.find(x=>x.mesh===mesh);gameTweens.delete(mesh);group.remove(mesh);mesh.geometry.dispose();disposeMaterial(mesh.material);if(item?.support){group.remove(item.support);item.support.geometry.dispose();disposeMaterial(item.support.material);}objects=objects.filter(o=>o!==mesh);demoItems=demoItems.filter(o=>o.mesh!==mesh);if(objects.length===0){gameActive=false;renderer.domElement.style.cursor='default';$('playBtn')?.classList.remove('active');$('gameStatus').hidden=false;$('playBtn').textContent=tr('gameWon');setTimeout(()=>{if(!gameActive&&$('playBtn'))$('playBtn').textContent=tr('play');},1400);}}
function markGameMistake(mesh){disposeMaterial(mesh.material);mesh.material=makePatternMaterial(0xff2020,.42,0,'checker');}
function objectScreenInfo(mesh,rect,positionOverride=null){const world=positionOverride?positionOverride.clone():mesh.getWorldPosition(new THREE.Vector3());const ndc=world.clone().project(camera);const camP=world.clone().applyMatrix4(camera.matrixWorldInverse);const depth=Math.max(.05,-camP.z);mesh.geometry.computeBoundingSphere();const radiusWorld=(mesh.geometry.boundingSphere?.radius||.35)*Math.max(mesh.scale.x,mesh.scale.y,mesh.scale.z);const pxPerWorld=rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth);return {ndc,x:(ndc.x*.5+.5)*rect.width,y:(-.5*ndc.y+.5)*rect.height,r:Math.max(5,radiusWorld*pxPerWorld),world,depth};}
function forgivingPick(e){const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const exact=raycaster.intersectObjects(objects,false)[0]?.object;if(exact)return exact;const px=e.clientX-rect.left,py=e.clientY-rect.top;let best=null,bestScore=Infinity;for(const o of objects){if(!o.parent||!o.visible)continue;const s=objectScreenInfo(o,rect);if(s.ndc.z<-1||s.ndc.z>1)continue;const d=Math.hypot(px-s.x,py-s.y),hitR=Math.max(28,s.r*1.45+10);if(d<=hitR){const score=d/hitR;if(score<bestScore){bestScore=score;best=o;}}}return best;}
function rayPointForNdcAtDistance(ndcX,ndcY,distance){const p=new THREE.Vector3(ndcX,ndcY,.5).unproject(camera),dir=p.sub(camera.position).normalize();return camera.position.clone().add(dir.multiplyScalar(distance));}
function candidateFree(mesh,candidate,rect){const a=objectScreenInfo(mesh,rect,candidate);if(Math.abs(a.ndc.x)>.96||Math.abs(a.ndc.y)>.94)return false;for(const o of objects){if(o===mesh||!o.parent||!o.visible)continue;const b=objectScreenInfo(o,rect),gap=a.r+b.r+10;if(Math.hypot(a.x-b.x,a.y-b.y)<gap)return false;}return true;}
function moveWrongTowardCenter(mesh){const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return;const info=objectScreenInfo(mesh,rect),distance=camera.position.distanceTo(info.world),yNdc=clamp(info.ndc.y,-.88,.88);const candidates=[0];for(let d=.04;d<=.92;d+=.04)candidates.push(d,-d);let target=null;for(const xNdc of candidates){const c=rayPointForNdcAtDistance(xNdc,yNdc,distance);if(candidateFree(mesh,c,rect)){target=c;break;}}if(!target)return;const item=demoItems.find(x=>x.mesh===mesh);if(item)item.manual=true;gameTweens.set(mesh,{from:mesh.position.clone(),to:target.clone(),start:performance.now(),duration:380});if(item?.support)item.support.visible=false;}
function moveNearestTowardCamera(mesh){
  if(!mesh?.parent)return;
  const world=mesh.getWorldPosition(new THREE.Vector3());
  const ray=world.clone().sub(camera.position);
  const distance=ray.length();
  if(distance<=1.2)return;
  const targetDistance=Math.max(1.2,distance*.80);
  const distanceRatio=targetDistance/distance;
  const target=camera.position.clone().add(ray.normalize().multiplyScalar(targetDistance));
  const item=demoItems.find(x=>x.mesh===mesh);
  if(item)item.manual=true;
  gameTweens.set(mesh,{
    from:mesh.position.clone(),
    to:target,
    scaleFrom:mesh.scale.clone(),
    scaleTo:mesh.scale.clone().multiplyScalar(distanceRatio),
    start:performance.now(),
    duration:420
  });
  if(item?.support)item.support.visible=false;
}
function updateGameTweens(now){
  for(const [mesh,t] of gameTweens){
    if(!mesh.parent){gameTweens.delete(mesh);continue;}
    const u=clamp((now-t.start)/t.duration,0,1),s=u*u*(3-2*u);
    mesh.position.lerpVectors(t.from,t.to,s);
    if(t.scaleFrom&&t.scaleTo)mesh.scale.lerpVectors(t.scaleFrom,t.scaleTo,s);
    if(u>=1)gameTweens.delete(mesh);
  }
}
renderer.domElement.addEventListener('pointerup',e=>{if(!gameActive||testActive||e.button>0)return;const hit=forgivingPick(e);if(!hit)return;const nearest=nearestGameObject();if(hit===nearest){gameCorrect++;removeGameObject(hit);}else{gameWrong++;markGameMistake(hit);moveWrongTowardCenter(hit);moveNearestTowardCamera(nearest);}updateGameScore();});

function modeLabel(){return params.mode==='static'?tr('static'):params.mode==='lr'?tr('lr'):params.mode==='five'?tr('five'):tr('continuous');}
function applyLanguage(l){if(!I18N[l])l='en';lang=l;localStorage.setItem('mmp-language',l);document.documentElement.lang=l;document.title=tr('title');$('languageSelect').value=l;const txt={languageLabel:'language',brandDemo:'demo',motionTitle:'motionTitle',modeStatic:'static',modeLR:'lr',modeFive:'five',modeContinuous:'continuous',baselineLabel:'baseline',frequencyLabel:'frequency',focusDistanceLabel:'focusDistance',waveformLabel:'waveform',fovLabel:'fov',sceneDepthLabel:'sceneDepth',fullscreenBtn:'fullscreen',hideControlsBtn:'hide',resetBtn:'reset',testBtn:'depthTest',sceneBtn:'newScene',testTitle:'testTitle',testQuestion:'question',leftChoice:'left',rightChoice:'right',nextTrial:'changeScene',closeTest:'closeTest',testAutoFocusLabel:'autoFocusTest',gameScoreLabel:'gameScore',gameRulesTitle:'gameRules',gameRulesText:'gameRulesText'};for(const [id,k] of Object.entries(txt))if($(id))$(id).textContent=tr(k);$('legendText').innerHTML=tr('legend');$('hintText').innerHTML=tr('hint');$('panelToggle').title=tr('show');$('panelToggle').setAttribute('aria-label',tr('show'));$('modeText').textContent=modeLabel();$('pauseBtn').textContent=params.paused?tr('resume'):tr('pause');updatePlayButton();updateScore();updateTestState();updateGameScore();}

$('languageSelect').onchange=e=>applyLanguage(e.target.value);
for(const [id,keyName,fmt] of [['baseline','baselineCm',v=>v.toFixed(1)],['frequency','frequency',v=>v.toFixed(1)],['focusDistance','focusDistance',v=>v.toFixed(1)],['fov','fov',v=>v.toFixed(0)],['sceneDepth','sceneDepth',v=>v.toFixed(1)]]){$(id).oninput=e=>{const v=+e.target.value;params[keyName]=v;$(id+'Val').textContent=fmt(v);if(id==='fov'){camera.fov=v;camera.updateProjectionMatrix();layoutDemoScene();if(testActive)newTrial();}if(id==='sceneDepth')layoutDemoScene();if(id==='focusDistance'&&testActive&&!$('testAutoFocus').checked&&trial){trial.focusDistance=v;updateTestState();}};}
$('waveform').onchange=e=>params.waveform=e.target.value;
$('testAutoFocus').onchange=()=>{if(testActive)newTrial();};
$('modeButtons').onclick=e=>{const b=e.target.closest('button[data-mode]');if(!b)return;params.mode=b.dataset.mode;document.querySelectorAll('#modeButtons button').forEach(x=>x.classList.toggle('active',x===b));$('modeText').textContent=modeLabel();};
$('pauseBtn').onclick=()=>{params.paused=!params.paused;$('pauseBtn').textContent=params.paused?tr('resume'):tr('pause');};
$('fullscreenBtn').onclick=async()=>document.fullscreenElement?document.exitFullscreen?.():$('viewer').requestFullscreen?.();
$('hideControlsBtn').onclick=()=>document.body.classList.add('controlsHidden');$('panelToggle').onclick=()=>document.body.classList.remove('controlsHidden');
$('sceneBtn').onclick=()=>buildScene();$('testBtn').onclick=()=>setTest(!testActive);$('playBtn').onclick=()=>setGame(!gameActive);$('closeTest').onclick=()=>setTest(false);$('leftChoice').onclick=()=>answer('left');$('rightChoice').onclick=()=>answer('right');$('nextTrial').onclick=newTrial;$('testRatio').oninput=e=>{testRatio=clamp(+e.target.value/100,RMIN,RMAX);syncRatio();if(testActive)newTrial();};
$('resetBtn').onclick=()=>{setGame(false);Object.assign(params,{baselineCm:8,frequency:1.6,focusDistance:8,waveform:'sine',sceneDepth:2.4});for(const [id,v] of [['baseline',8],['frequency',1.6],['focusDistance',8],['fov',55],['sceneDepth',2.4]]){$(id).value=v;$(id+'Val').textContent=id==='fov'?'55':(+v).toFixed(1);} $('waveform').value='sine';camera.fov=55;camera.updateProjectionMatrix();layoutDemoScene();if(testActive)newTrial();};
$('exportCsv').onclick=()=>{const rows=[['time','mode','baseline_cm','frequency_hz','waveform','focus_distance_m','mean_distance_m','delta_m','relative_delta','relative_delta_percent','ratio_before','ratio_after','left_shape','right_shape','nearer','choice','correct'],...trials.map(t=>[t.time,t.mode,t.baselineCm,t.frequency,t.waveform,t.focusDistance,t.meanDistance,t.delta,t.ratio,t.ratio*100,t.ratioBefore,t.ratioAfter,t.leftType,t.rightType,t.nearer,t.choice,t.correct])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='motion-parallax-trials.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};

buildScene();fitViewer();applyLanguage(lang);
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();$('pauseBtn').click();}if(e.key.toLowerCase()==='f')$('fullscreenBtn').click();});
addEventListener('resize',fitViewer);document.addEventListener('fullscreenchange',()=>setTimeout(fitViewer,0));
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;if(!params.paused)elapsed+=dt;updateCamera(elapsed);updateGameTweens(now);if(!testActive)objects.forEach((o,i)=>o.rotation.y+=dt*(.10+.018*i));renderer.render(scene,camera);fpsSmooth=fpsSmooth*.92+(1/Math.max(dt,.0001))*.08;$('fps').textContent=`${fpsSmooth.toFixed(0)} fps`;}
requestAnimationFrame(loop);