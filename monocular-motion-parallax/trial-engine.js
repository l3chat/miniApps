export function createTrialEngine({camera,getObjects}){
  let state=null;

  function distanceTo(mesh){
    return camera.position.distanceTo(mesh.getWorldPosition(mesh.position.clone()));
  }

  function rankedCandidates(){
    return getObjects()
      .filter(o=>o.parent&&o.visible)
      .map(mesh=>({mesh,distance:distanceTo(mesh)}))
      .sort((a,b)=>a.distance-b.distance);
  }

  function startStep(){
    const ranked=rankedCandidates();
    const nearest=ranked[0]||null;
    const second=ranked[1]||null;
    state={
      startedAt:performance.now(),
      nearest:nearest?.mesh||null,
      nearestDistance:nearest?.distance??null,
      secondNearest:second?.mesh||null,
      secondNearestDistance:second?.distance??null,
      delta:nearest&&second?second.distance-nearest.distance:null,
      relativeDelta:nearest&&second?(second.distance-nearest.distance)/nearest.distance:null,
      excluded:new Set(),
      meaningfulErrors:0,
      resolved:false,
      unresolved:false
    };
    return state;
  }

  function ensure(){return state?.nearest?.parent?state:startStep();}

  function choose(mesh){
    const s=ensure();
    if(!mesh||!s.nearest)return {type:'none',state:s};
    if(s.excluded.has(mesh))return {type:'ignored',state:s};
    const responseTimeMs=performance.now()-s.startedAt;
    if(mesh===s.nearest){
      s.resolved=true;
      return {type:'correct',state:s,responseTimeMs,mesh};
    }
    s.excluded.add(mesh);
    s.meaningfulErrors++;
    return {type:'wrong',state:s,responseTimeMs,mesh,nearest:s.nearest,errorCount:s.meaningfulErrors};
  }

  function markUnresolved(){
    const s=ensure();
    s.unresolved=true;
    return s;
  }

  function reset(){state=null;}
  function getState(){return state;}

  return {startStep,choose,markUnresolved,reset,getState,rankedCandidates};
}
