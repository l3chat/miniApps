export function createTrialEngine({camera,getObjects}){
  let state=null;

  // Depth is measured along the central viewing axis, not Euclidean distance
  // to the laterally moving camera. Horizontal separation must not change
  // which object is physically nearer/farther in the trial.
  function distanceTo(mesh){
    const p=mesh.getWorldPosition(mesh.position.clone());
    return Math.max(0,camera.position.z-p.z);
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
      unresolved:false,
      uncertain:false
    };
    return state;
  }

  function ensure(){return state?.nearest?.parent?state:startStep();}
  function choose(mesh){
    const s=ensure();
    if(!mesh||!s.nearest)return {type:'none',state:s};
    if(s.excluded.has(mesh))return {type:'ignored',state:s};
    const responseTimeMs=performance.now()-s.startedAt;
    if(mesh===s.nearest){s.resolved=true;return {type:'correct',state:s,responseTimeMs,mesh};}
    s.excluded.add(mesh);s.meaningfulErrors++;
    return {type:'wrong',state:s,responseTimeMs,mesh,nearest:s.nearest,errorCount:s.meaningfulErrors};
  }
  function uncertain(){const s=ensure();if(!s.nearest)return {type:'none',state:s};s.uncertain=true;return {type:'uncertain',state:s,responseTimeMs:performance.now()-s.startedAt};}
  function markUnresolved(){const s=ensure();s.unresolved=true;return s;}
  function snapshot(s=state){if(!s)return null;return {nearestObjectId:s.nearest?.uuid??null,secondNearestObjectId:s.secondNearest?.uuid??null,nearestDistanceM:s.nearestDistance,secondNearestDistanceM:s.secondNearestDistance,deltaM:s.delta,relativeDelta:s.relativeDelta,meaningfulErrors:s.meaningfulErrors,resolved:s.resolved,unresolved:s.unresolved,uncertain:s.uncertain};}
  function reset(){state=null;}
  function getState(){return state;}
  return {startStep,choose,uncertain,markUnresolved,reset,getState,snapshot,rankedCandidates};
}
