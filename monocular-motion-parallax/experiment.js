export function createExperimentMode(){
  let active=false;
  function start(){active=true;}
  function stop(){active=false;}
  function isActive(){return active;}
  return {start,stop,isActive};
}
