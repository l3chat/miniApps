export function createExperimentMode({onTrial=()=>{}}={}){
  let active=false;
  let sessionId=null;

  function makeId(){
    return `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  }

  function start(){
    active=true;
    sessionId=makeId();
    return sessionId;
  }

  function stop(){active=false;}
  function isActive(){return active;}

  function recordTrial(trial){
    const record={
      sessionId,
      timestamp:new Date().toISOString(),
      ...trial
    };
    onTrial(record);
    return record;
  }

  return {start,stop,isActive,recordTrial,getSessionId:()=>sessionId};
}
