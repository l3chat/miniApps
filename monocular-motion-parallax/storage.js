const STORAGE_KEY='mmp-lab-state';
const SCHEMA_VERSION=1;
const TRAINING_HISTORY_LIMIT=500;
const EXPERIMENT_HISTORY_LIMIT=2000;

const DEFAULT_STATE={
  schemaVersion:SCHEMA_VERSION,
  settings:{
    language:null,
    panelHidden:false,
    lastAppMode:'training',
    camera:{
      mode:'static',
      baselineCm:8,
      frequency:1.6,
      focusDistance:8,
      waveform:'sine'
    },
    scene:{
      fov:55,
      sceneDepth:2.4
    },
    calibration:null
  },
  lastTrainingResult:null,
  trainingHistory:[],
  experimentHistory:[]
};

function clone(v){return JSON.parse(JSON.stringify(v));}
function isObject(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function merge(base,patch){
  const out={...base};
  for(const [k,v] of Object.entries(patch||{})){
    out[k]=isObject(v)&&isObject(base?.[k])?merge(base[k],v):v;
  }
  return out;
}

function normalize(state){
  state.schemaVersion=SCHEMA_VERSION;
  state.trainingHistory=Array.isArray(state.trainingHistory)?state.trainingHistory.slice(-TRAINING_HISTORY_LIMIT):[];
  state.experimentHistory=Array.isArray(state.experimentHistory)?state.experimentHistory.slice(-EXPERIMENT_HISTORY_LIMIT):[];
  return state;
}

function migrate(raw){
  if(!isObject(raw))return clone(DEFAULT_STATE);
  if(raw.schemaVersion===SCHEMA_VERSION){
    return normalize(merge(clone(DEFAULT_STATE),raw));
  }
  // Future version-specific migrations should be added above this fallback.
  // Preserve only data that can be merged into the current structure, then
  // explicitly stamp the current schema version.
  return normalize(merge(clone(DEFAULT_STATE),raw));
}

export function createStorage(){
  let state;
  try{
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    state=migrate(parsed);
  }catch{
    state=clone(DEFAULT_STATE);
  }

  // Migrate the language key used by the pre-storage versions of the app.
  if(!state.settings.language){
    const oldLang=localStorage.getItem('mmp-language');
    if(oldLang)state.settings.language=oldLang;
  }

  function persist(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}
    catch(err){console.warn('Could not persist MMP state',err);return false;}
  }

  function getState(){return clone(state);}
  function getSettings(){return clone(state.settings);}

  function updateSettings(patch){
    state.settings=merge(state.settings,patch||{});
    persist();
    return getSettings();
  }

  function setLastTrainingResult(result){
    state.lastTrainingResult=result?clone(result):null;
    persist();
  }

  function appendTrainingSession(session){
    if(!session)return;
    state.trainingHistory.push(clone(session));
    if(state.trainingHistory.length>TRAINING_HISTORY_LIMIT){
      state.trainingHistory.splice(0,state.trainingHistory.length-TRAINING_HISTORY_LIMIT);
    }
    state.lastTrainingResult=clone(session);
    persist();
  }

  function appendExperimentTrial(trial){
    if(!trial)return;
    state.experimentHistory.push(clone(trial));
    if(state.experimentHistory.length>EXPERIMENT_HISTORY_LIMIT){
      state.experimentHistory.splice(0,state.experimentHistory.length-EXPERIMENT_HISTORY_LIMIT);
    }
    persist();
  }

  function clearTrainingHistory(){state.trainingHistory=[];state.lastTrainingResult=null;persist();}
  function clearExperimentHistory(){state.experimentHistory=[];persist();}

  // Persist immediately so schemaVersion and legacy migrations are committed.
  persist();

  return {
    schemaVersion:SCHEMA_VERSION,
    getState,getSettings,updateSettings,
    setLastTrainingResult,appendTrainingSession,appendExperimentTrial,
    clearTrainingHistory,clearExperimentHistory
  };
}
