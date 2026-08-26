import { I18N } from './i18n.js';
import { createWorld } from './scene.js';
import { createCameraMotion } from './camera-motion.js';
import { createTrialEngine } from './trial-engine.js';
import { createTrainingMode } from './training.js';
import { createExperimentMode } from './experiment.js';
import { createStorage } from './storage.js';
import { modeText } from './ui.js';
import { APP_VERSION, SCREEN_DIAGONAL_INCHES } from './version.js';

const $=id=>document.getElementById(id);
const storage=createStorage();
const saved=storage.getSettings();

function detectLang(){if(saved.language&&I18N[saved.language])return saved.language;const n=(navigator.language||'').toLowerCase();for(const l of ['ru','de','uk','fr','en'])if(n.startsWith(l))return l;return 'ru';}
let lang=detectLang();
const tr=k=>I18N[lang]?.[k]??I18N.en[k]??k;

const LANGUAGE_LABELS={ru:'Язык / Language',en:'Language',de:'Sprache / Language',uk:'Мова / Language',fr:'Langue / Language'};

const world=createWorld($('app'));
const {renderer,camera}=world;
const cameraMotion=createCameraMotion(camera,({xCm,focusDistance})=>{
  $('camx').textContent=xCm.toFixed(1);
  $('focusHud').textContent=focusDistance.toFixed(1);
  world.setScreenSway(xCm/100);
});
const trialEngine=createTrialEngine({camera,getObjects:world.getObjects});

$('versionText').textContent=`v${APP_VERSION}`;
$('screenText').textContent=`screen ${SCREEN_DIAGONAL_INCHES}″`;

function cameraSnapshot(){return {mode:cameraMotion.params.mode,baselineCm:cameraMotion.params.baselineCm,frequencyHz:cameraMotion.params.frequency,focusDistanceM:cameraMotion.params.focusDistance,waveform:cameraMotion.params.waveform};}
function sceneSnapshot(){return {fovDeg:camera.fov,sceneDepthM:+$('sceneDepth').value,screenDiagonalInches:SCREEN_DIAGONAL_INCHES,screenPlaneDistanceM:world.screenPlaneDistance};}
function saveSettings(extra={}){storage.updateSettings({language:lang,panelHidden:document.body.classList.contains('controlsHidden'),camera:{mode:cameraMotion.params.mode,baselineCm:cameraMotion.params.baselineCm,frequency:cameraMotion.params.frequency,focusDistance:cameraMotion.params.focusDistance,waveform:cameraMotion.params.waveform},scene:{fov:camera.fov,sceneDepth:+$('sceneDepth').value,screenDiagonalInches:SCREEN_DIAGONAL_INCHES},...extra});}

let lastTrainingStats={correct:0,wrong:0,unresolved:0,score:100,active:false};
let lastExperimentState={active:false,trialNo:0,total:0,threshold80:null};

function updateExperimentStatus(state=lastExperimentState){
  lastExperimentState=state;
  const threshold=state.threshold80?`${(state.threshold80*100).toFixed(2)}%`:modeText(lang,'estimating');
  $('experimentStatus').textContent=`${modeText(lang,'trial')}: ${state.trialNo||0} · ${modeText(lang,'answers')}: ${state.total||0} · ${modeText(lang,'threshold')}: ${threshold}`;
  $('experimentBtn').textContent=state.active?modeText(lang,'stopExperiment'):modeText(lang,'experiment');
  $('experimentBtn').classList.toggle('active',Boolean(state.active));
  $('experimentPanel').hidden=!state.active;
}

function setExperimentLock(locked){
  for(const id of ['baseline','frequency','focusDistance','waveform','fov','sceneDepth'])if($(id))$(id).disabled=locked;
  document.querySelectorAll('#modeButtons button').forEach(b=>b.disabled=locked);
  $('sceneBtn').disabled=locked;
}

const experiment=createExperimentMode({
  world,trialEngine,
  getParameters:()=>({...cameraSnapshot(),...sceneSnapshot(),appVersion:APP_VERSION}),
  onTrial:trial=>storage.appendExperimentTrial(trial),
  onState:updateExperimentStatus
});

const training=createTrainingMode({
  world,trialEngine,maxErrors:3,
  onScore:stats=>{
    lastTrainingStats=stats;$('gameStatus').hidden=false;$('gameScore').textContent=`${stats.score}%`;$('unresolvedStatus').textContent=stats.unresolved?` · ${modeText(lang,'unresolved')}: ${stats.unresolved}`:'';
    storage.setLastTrainingResult({...stats,timestamp:new Date().toISOString(),inProgress:stats.active,camera:cameraSnapshot(),scene:sceneSnapshot(),appVersion:APP_VERSION});updateTrainingButton();
  },
  onSessionEnd:session=>storage.appendTrainingSession({...session,timestamp:session.endedAt||new Date().toISOString(),camera:cameraSnapshot(),scene:sceneSnapshot(),appVersion:APP_VERSION}),
  onWin:stats=>{lastTrainingStats=stats;$('trainingBtn').textContent=tr('gameWon');setTimeout(updateTrainingButton,1200);}
});

function updateTrainingButton(){$('trainingBtn').textContent=training.isActive()?tr('stopGame'):modeText(lang,'training');$('trainingBtn').classList.toggle('active',training.isActive());}
function modeLabel(){const m=cameraMotion.params.mode;return m==='static'?tr('static'):m==='lr'?tr('lr'):m==='five'?tr('five'):tr('continuous');}

function applyLanguage(next,{persist=true}={}){
  if(!I18N[next])next='en';lang=next;document.documentElement.lang=lang;document.title=tr('title');$('languageSelect').value=lang;
  const labels={brandDemo:'demo',motionTitle:'motionTitle',modeStatic:'static',modeLR:'lr',modeFive:'five',modeContinuous:'continuous',baselineLabel:'baseline',frequencyLabel:'frequency',focusDistanceLabel:'focusDistance',waveformLabel:'waveform',fovLabel:'fov',sceneDepthLabel:'sceneDepth',fullscreenBtn:'fullscreen',hideControlsBtn:'hide',resetBtn:'reset',sceneBtn:'newScene',gameScoreLabel:'gameScore',gameRulesTitle:'gameRules',gameRulesText:'gameRulesText'};
  for(const [id,key] of Object.entries(labels))if($(id))$(id).textContent=tr(key);
  $('languageLabel').textContent=LANGUAGE_LABELS[lang]??'Language';
  $('legendText').innerHTML=tr('legend');$('hintText').innerHTML=tr('hint');$('panelToggle').title=tr('show');$('panelToggle').setAttribute('aria-label',tr('show'));$('modeText').textContent=modeLabel();$('pauseBtn').textContent=cameraMotion.params.paused?tr('resume'):tr('pause');$('uncertainBtn').textContent=modeText(lang,'uncertain');$('unresolvedStatus').textContent=lastTrainingStats.unresolved?` · ${modeText(lang,'unresolved')}: ${lastTrainingStats.unresolved}`:'';updateTrainingButton();updateExperimentStatus(lastExperimentState);if(persist)saveSettings();
}

function restoreSettings(){
  const c=saved.camera||{},s=saved.scene||{};cameraMotion.set('mode',c.mode??'static');cameraMotion.set('baselineCm',Number(c.baselineCm??8));cameraMotion.set('frequency',Number(c.frequency??1.6));cameraMotion.set('focusDistance',Number(c.focusDistance??8));cameraMotion.set('waveform',c.waveform??'sine');
  const fov=Number(s.fov??55),sceneDepth=Number(s.sceneDepth??2.4);world.setFov(fov);world.setSceneDepth(sceneDepth);
  $('baseline').value=cameraMotion.params.baselineCm;$('baselineVal').textContent=cameraMotion.params.baselineCm.toFixed(1);$('frequency').value=cameraMotion.params.frequency;$('frequencyVal').textContent=cameraMotion.params.frequency.toFixed(1);$('focusDistance').value=cameraMotion.params.focusDistance;$('focusDistanceVal').textContent=cameraMotion.params.focusDistance.toFixed(1);$('waveform').value=cameraMotion.params.waveform;$('fov').value=fov;$('fovVal').textContent=fov.toFixed(0);$('sceneDepth').value=sceneDepth;$('sceneDepthVal').textContent=sceneDepth.toFixed(1);
  document.querySelectorAll('#modeButtons button').forEach(x=>x.classList.toggle('active',x.dataset.mode===cameraMotion.params.mode));document.body.classList.toggle('controlsHidden',Boolean(saved.panelHidden));
  const previous=storage.getState().lastTrainingResult;if(previous){lastTrainingStats={correct:Number(previous.correct||0),wrong:Number(previous.wrong||0),unresolved:Number(previous.unresolved||0),score:Number(previous.score??100),active:false};$('gameStatus').hidden=false;$('gameScore').textContent=`${lastTrainingStats.score}%`;$('unresolvedStatus').textContent=lastTrainingStats.unresolved?` · ${modeText(lang,'unresolved')}: ${lastTrainingStats.unresolved}`:'';}
}

function fit(){world.fit($('viewer'));}
new ResizeObserver(fit).observe($('viewer'));addEventListener('resize',fit);document.addEventListener('fullscreenchange',()=>setTimeout(fit,0));

$('languageSelect').onchange=e=>applyLanguage(e.target.value);
$('modeButtons').onclick=e=>{const b=e.target.closest('button[data-mode]');if(!b||b.disabled)return;cameraMotion.set('mode',b.dataset.mode);document.querySelectorAll('#modeButtons button').forEach(x=>x.classList.toggle('active',x===b));$('modeText').textContent=modeLabel();saveSettings();};
for(const [id,key,fmt] of [['baseline','baselineCm',v=>v.toFixed(1)],['frequency','frequency',v=>v.toFixed(1)],['focusDistance','focusDistance',v=>v.toFixed(1)]]){$(id).oninput=e=>{const v=+e.target.value;cameraMotion.set(key,v);$(id+'Val').textContent=fmt(v);saveSettings();};}
$('waveform').onchange=e=>{cameraMotion.set('waveform',e.target.value);saveSettings();};$('fov').oninput=e=>{const v=+e.target.value;world.setFov(v);$('fovVal').textContent=v.toFixed(0);saveSettings();};$('sceneDepth').oninput=e=>{const v=+e.target.value;world.setSceneDepth(v);$('sceneDepthVal').textContent=v.toFixed(1);saveSettings();};
$('pauseBtn').onclick=()=>{cameraMotion.params.paused=!cameraMotion.params.paused;$('pauseBtn').textContent=cameraMotion.params.paused?tr('resume'):tr('pause');};$('fullscreenBtn').onclick=async()=>document.fullscreenElement?document.exitFullscreen?.():$('viewer').requestFullscreen?.();$('hideControlsBtn').onclick=()=>{document.body.classList.add('controlsHidden');saveSettings();};$('panelToggle').onclick=()=>{document.body.classList.remove('controlsHidden');saveSettings();};

$('trainingBtn').onclick=()=>{
  const wasExperiment=experiment.isActive();
  if(wasExperiment){experiment.stop();setExperimentLock(false);world.buildScene();trialEngine.reset();}
  if(training.isActive())training.stop('stopped');
  else{if(world.getObjects().length===0)world.buildScene();training.start();storage.updateSettings({lastAppMode:'training'});}
  updateTrainingButton();
};

$('experimentBtn').onclick=()=>{
  if(experiment.isActive()){
    experiment.stop();setExperimentLock(false);world.buildScene();trialEngine.reset();
  }else{
    if(training.isActive())training.stop('switch-to-experiment');
    setExperimentLock(true);experiment.start();storage.updateSettings({lastAppMode:'experiment'});
  }
  updateTrainingButton();
};

$('uncertainBtn').onclick=()=>experiment.answerUncertain();
$('sceneBtn').onclick=()=>{world.buildScene();trialEngine.reset();if(training.isActive())training.start();};
$('resetBtn').onclick=()=>{if(training.isActive())training.stop('reset');if(experiment.isActive())experiment.stop();setExperimentLock(false);cameraMotion.reset();const defaults={baseline:8,frequency:1.6,focusDistance:8,fov:55,sceneDepth:2.4};for(const [id,v] of Object.entries(defaults)){if($(id)){ $(id).value=v;$(id+'Val').textContent=id==='fov'?String(v):Number(v).toFixed(1); }}$('waveform').value='sine';world.setFov(55);world.setSceneDepth(2.4);world.buildScene();trialEngine.reset();document.querySelectorAll('#modeButtons button').forEach(x=>x.classList.toggle('active',x.dataset.mode==='static'));$('modeText').textContent=modeLabel();saveSettings({lastAppMode:'training'});updateTrainingButton();updateExperimentStatus({active:false,trialNo:0,total:0,threshold80:null});};

addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();$('pauseBtn').click();}if(e.key.toLowerCase()==='f')$('fullscreenBtn').click();});

world.buildScene();restoreSettings();fit();applyLanguage(lang,{persist:false});saveSettings();updateExperimentStatus(lastExperimentState);
let elapsed=0,last=performance.now(),fpsSmooth=60;
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;if(!cameraMotion.params.paused)elapsed+=dt;cameraMotion.update(elapsed);training.updateTweens(now);for(const o of world.getObjects())o.rotation.y+=dt*.16;renderer.render(world.scene,camera);fpsSmooth=fpsSmooth*.92+(1/Math.max(dt,.0001))*.08;$('fps').textContent=`${fpsSmooth.toFixed(0)} fps`;}
requestAnimationFrame(loop);
