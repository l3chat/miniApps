import { I18N } from './i18n.js';
import { createWorld } from './scene.js';
import { createCameraMotion } from './camera-motion.js';
import { createTrialEngine } from './trial-engine.js';
import { createTrainingMode } from './training.js';
import { createExperimentMode } from './experiment.js';
import { modeText } from './ui.js';

const $=id=>document.getElementById(id);
function detectLang(){const saved=localStorage.getItem('mmp-language');if(saved&&I18N[saved])return saved;const n=(navigator.language||'').toLowerCase();for(const l of ['ru','de','uk','fr','en'])if(n.startsWith(l))return l;return 'ru';}
let lang=detectLang();
const tr=k=>I18N[lang]?.[k]??I18N.en[k]??k;

const world=createWorld($('app'));
const {renderer,camera}=world;
const cameraMotion=createCameraMotion(camera,({xCm,focusDistance})=>{$('camx').textContent=xCm.toFixed(1);$('focusHud').textContent=focusDistance.toFixed(1);});
const trialEngine=createTrialEngine({camera,getObjects:world.getObjects});
const experiment=createExperimentMode();
let lastTrainingStats={correct:0,wrong:0,unresolved:0,score:100,active:false};

const training=createTrainingMode({
  world,trialEngine,maxErrors:3,
  onScore:stats=>{
    lastTrainingStats=stats;
    $('gameStatus').hidden=false;
    $('gameScore').textContent=`${stats.score}%`;
    $('unresolvedStatus').textContent=stats.unresolved?` · ${modeText(lang,'unresolved')}: ${stats.unresolved}`:'';
    updateTrainingButton();
  },
  onWin:stats=>{
    lastTrainingStats=stats;
    $('trainingBtn').textContent=tr('gameWon');
    setTimeout(updateTrainingButton,1200);
  }
});

function updateTrainingButton(){
  $('trainingBtn').textContent=training.isActive()?tr('stopGame'):modeText(lang,'training');
  $('trainingBtn').classList.toggle('active',training.isActive());
}
function modeLabel(){const m=cameraMotion.params.mode;return m==='static'?tr('static'):m==='lr'?tr('lr'):m==='five'?tr('five'):tr('continuous');}
function applyLanguage(next){
  if(!I18N[next])next='en';lang=next;localStorage.setItem('mmp-language',lang);document.documentElement.lang=lang;document.title=tr('title');$('languageSelect').value=lang;
  const labels={languageLabel:'language',brandDemo:'demo',motionTitle:'motionTitle',modeStatic:'static',modeLR:'lr',modeFive:'five',modeContinuous:'continuous',baselineLabel:'baseline',frequencyLabel:'frequency',focusDistanceLabel:'focusDistance',waveformLabel:'waveform',fovLabel:'fov',sceneDepthLabel:'sceneDepth',fullscreenBtn:'fullscreen',hideControlsBtn:'hide',resetBtn:'reset',sceneBtn:'newScene',gameScoreLabel:'gameScore',gameRulesTitle:'gameRules',gameRulesText:'gameRulesText'};
  for(const [id,key] of Object.entries(labels))if($(id))$(id).textContent=tr(key);
  $('legendText').innerHTML=tr('legend');$('hintText').innerHTML=tr('hint');$('panelToggle').title=tr('show');$('panelToggle').setAttribute('aria-label',tr('show'));$('modeText').textContent=modeLabel();$('pauseBtn').textContent=cameraMotion.params.paused?tr('resume'):tr('pause');$('experimentBtn').textContent=modeText(lang,'experiment');$('experimentStatus').textContent=modeText(lang,'experimentSoon');$('unresolvedStatus').textContent=lastTrainingStats.unresolved?` · ${modeText(lang,'unresolved')}: ${lastTrainingStats.unresolved}`:'';updateTrainingButton();
}
function fit(){world.fit($('viewer'));}
new ResizeObserver(fit).observe($('viewer'));addEventListener('resize',fit);document.addEventListener('fullscreenchange',()=>setTimeout(fit,0));

$('languageSelect').onchange=e=>applyLanguage(e.target.value);
$('modeButtons').onclick=e=>{const b=e.target.closest('button[data-mode]');if(!b)return;cameraMotion.set('mode',b.dataset.mode);document.querySelectorAll('#modeButtons button').forEach(x=>x.classList.toggle('active',x===b));$('modeText').textContent=modeLabel();};
for(const [id,key,fmt] of [['baseline','baselineCm',v=>v.toFixed(1)],['frequency','frequency',v=>v.toFixed(1)],['focusDistance','focusDistance',v=>v.toFixed(1)]]){$(id).oninput=e=>{const v=+e.target.value;cameraMotion.set(key,v);$(id+'Val').textContent=fmt(v);};}
$('waveform').onchange=e=>cameraMotion.set('waveform',e.target.value);
$('fov').oninput=e=>{const v=+e.target.value;world.setFov(v);$('fovVal').textContent=v.toFixed(0);};
$('sceneDepth').oninput=e=>{const v=+e.target.value;world.setSceneDepth(v);$('sceneDepthVal').textContent=v.toFixed(1);};
$('pauseBtn').onclick=()=>{cameraMotion.params.paused=!cameraMotion.params.paused;$('pauseBtn').textContent=cameraMotion.params.paused?tr('resume'):tr('pause');};
$('fullscreenBtn').onclick=async()=>document.fullscreenElement?document.exitFullscreen?.():$('viewer').requestFullscreen?.();
$('hideControlsBtn').onclick=()=>document.body.classList.add('controlsHidden');$('panelToggle').onclick=()=>document.body.classList.remove('controlsHidden');
$('trainingBtn').onclick=()=>{experiment.stop();$('experimentStatus').hidden=true;if(training.isActive())training.stop();else{if(world.getObjects().length===0)world.buildScene();training.start();}updateTrainingButton();};
$('experimentBtn').onclick=()=>{if(training.isActive())training.stop();experiment.start();$('experimentStatus').hidden=false;updateTrainingButton();};
$('sceneBtn').onclick=()=>{world.buildScene();trialEngine.reset();if(training.isActive())training.start();};
$('resetBtn').onclick=()=>{if(training.isActive())training.stop();experiment.stop();$('experimentStatus').hidden=true;cameraMotion.reset();const defaults={baseline:8,frequency:1.6,focusDistance:8,fov:55,sceneDepth:2.4};for(const [id,v] of Object.entries(defaults)){if($(id)){ $(id).value=v; $(id+'Val').textContent=id==='fov'?String(v):Number(v).toFixed(1); }}$('waveform').value='sine';world.setFov(55);world.setSceneDepth(2.4);document.querySelectorAll('#modeButtons button').forEach(x=>x.classList.toggle('active',x.dataset.mode==='static'));$('modeText').textContent=modeLabel();updateTrainingButton();};
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();$('pauseBtn').click();}if(e.key.toLowerCase()==='f')$('fullscreenBtn').click();});

world.buildScene();fit();applyLanguage(lang);
let elapsed=0,last=performance.now(),fpsSmooth=60;
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;if(!cameraMotion.params.paused)elapsed+=dt;cameraMotion.update(elapsed);training.updateTweens(now);for(const o of world.getObjects())o.rotation.y+=dt*.16;renderer.render(world.scene,camera);fpsSmooth=fpsSmooth*.92+(1/Math.max(dt,.0001))*.08;$('fps').textContent=`${fpsSmooth.toFixed(0)} fps`;}
requestAnimationFrame(loop);
