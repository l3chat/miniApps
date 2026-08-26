import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { SCREEN_DIAGONAL_INCHES } from './version.js';

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const colors=[0xff7a85,0x78c7ff,0x8ee0b1,0xf6c86b,0xb89cff,0xffa66f,0x72e2ef,0xf08cc8,0xa8df65];
const shapes=['sphere','box','torus','cone','cylinder','dodeca','octa','knot'];
const patternKinds=['squares','triangles','checker'];
const SCREEN_PLANE_DISTANCE_M=1.0;
const SCREEN_GRID_SWAY_FRACTION=.15;

function geometryFor(type){
  if(type==='sphere')return new THREE.SphereGeometry(.34,40,28);
  if(type==='box')return new THREE.BoxGeometry(.58,.58,.58);
  if(type==='torus')return new THREE.TorusGeometry(.28,.10,18,48);
  if(type==='cone')return new THREE.ConeGeometry(.35,.72,32);
  if(type==='cylinder')return new THREE.CylinderGeometry(.27,.34,.68,32);
  if(type==='dodeca')return new THREE.DodecahedronGeometry(.36);
  if(type==='octa')return new THREE.OctahedronGeometry(.40);
  return new THREE.TorusKnotGeometry(.23,.075,80,12);
}

function colorCss(hex){return `#${new THREE.Color(hex).getHexString()}`;}
function contrastCss(hex){const c=new THREE.Color(hex);const l=.2126*c.r+.7152*c.g+.0722*c.b;return l>.46?'#10141d':'#ffffff';}

export function makePatternTexture(renderer,baseColor,kind=pick(patternKinds)){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle=colorCss(baseColor);ctx.fillRect(0,0,128,128);ctx.fillStyle=contrastCss(baseColor);
  if(kind==='squares')for(let y=0;y<4;y++)for(let x=0;x<4;x++)ctx.fillRect(x*32+9,y*32+9,14,14);
  else if(kind==='triangles')for(let y=0;y<4;y++)for(let x=0;x<4;x++){const cx=x*32+16,cy=y*32+16,r=11;ctx.beginPath();if((x+y)%2===0){ctx.moveTo(cx,cy-r);ctx.lineTo(cx-r,cy+r);ctx.lineTo(cx+r,cy+r);}else{ctx.moveTo(cx,cy+r);ctx.lineTo(cx-r,cy-r);ctx.lineTo(cx+r,cy-r);}ctx.closePath();ctx.fill();}
  else for(let y=0;y<4;y++)for(let x=0;x<4;x++)if((x+y)%2===0)ctx.fillRect(x*32,y*32,32,32);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1.8,1.8);texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}

export function makePatternMaterial(renderer,color,rough=.4,metal=.05,kind){return new THREE.MeshStandardMaterial({color:0xffffff,map:makePatternTexture(renderer,color,kind),roughness:rough,metalness:metal});}
export function disposeMaterial(material){for(const m of (Array.isArray(material)?material:[material])){if(!m)continue;m.map?.dispose();m.dispose?.();}}

export function createWorld(appElement){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;appElement.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x09101d);scene.fog=new THREE.Fog(0x09101d,10,34);
  const camera=new THREE.PerspectiveCamera(55,1,.05,80);camera.position.set(0,1.55,5.8);scene.add(camera);
  const objectGroup=new THREE.Group();scene.add(objectGroup);
  const hemi=new THREE.HemisphereLight(0xdde8ff,0x20304a,1.7),key=new THREE.DirectionalLight(0xffffff,2.6),rim=new THREE.PointLight(0x68a8ff,12,15);key.position.set(3,6,4);key.castShadow=true;rim.position.set(-3,2.5,-1);scene.add(hemi,key,rim);

  // The whole viewport represents a calibrated 10-inch display. The grid is
  // attached to that screen plane, but receives a small counter-sway so it is
  // not perfectly locked to the display during virtual camera motion.
  const screenGroup=new THREE.Group();screenGroup.position.set(0,0,-SCREEN_PLANE_DISTANCE_M);camera.add(screenGroup);
  const screenGrid=new THREE.GridHelper(1,10,0xd9e8ff,0x78a5d8);screenGrid.rotation.x=Math.PI/2;screenGrid.material.transparent=true;screenGrid.material.opacity=.72;screenGrid.material.depthWrite=false;screenGrid.renderOrder=20;screenGroup.add(screenGrid);

  let objects=[],items=[],sceneDepth=2.4;

  function updateScreenPlane(){
    const halfH=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*SCREEN_PLANE_DISTANCE_M;
    const h=halfH*2;
    const w=h*Math.max(.15,camera.aspect||1);
    screenGrid.scale.set(w,1,h);
  }

  function setScreenSway(cameraXMeters=0){
    screenGroup.position.x=-cameraXMeters*SCREEN_GRID_SWAY_FRACTION;
  }

  function clearObjects(){objectGroup.traverse(o=>{o.geometry?.dispose();disposeMaterial(o.material);});objectGroup.clear();objects=[];items=[];}

  function pointAtExactDistance(ndcX,ndcY,distance){const p=new THREE.Vector3(ndcX,ndcY,.5).unproject(camera);const dir=p.sub(camera.position).normalize();return camera.position.clone().add(dir.multiplyScalar(distance));}

  function addVisualObject({distance,ndcX,ndcY,angularRadius=THREE.MathUtils.degToRad(rand(5.8,8.2)),type=pick(shapes),color=pick(colors)}){
    const geometry=geometryFor(type);geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,makePatternMaterial(renderer,color,.35+Math.random()*.2,Math.random()*.1));
    const scale=Math.tan(angularRadius)*distance/Math.max(geometry.boundingSphere?.radius||.35,.001);
    mesh.position.copy(pointAtExactDistance(ndcX,ndcY,distance));mesh.scale.setScalar(scale);mesh.rotation.set(rand(0,.7),rand(0,Math.PI*2),rand(0,.5));mesh.castShadow=mesh.receiveShadow=true;
    objectGroup.add(mesh);objects.push(mesh);items.push({mesh,support:null,manual:true,excluded:false});return mesh;
  }

  function buildDepthScene(relativeDelta=.06,{count=10,adaptive=false}={}){
    clearObjects();scene.background=new THREE.Color(0x09101d);
    const r=clamp(relativeDelta,.002,.30);
    const depthScale=clamp(sceneDepth/2.4,.22,2.2);
    const frontMin=clamp(1-(1-.62)*depthScale,.25,.92);
    const frontMax=clamp(1-(1-.90)*depthScale,.45,.98);
    const backMin=1+(1.08-1)*depthScale;
    const backMax=1+(2.35-1)*depthScale;
    const d1=rand(frontMin,frontMax);
    const d2=d1*(1+r);
    const distances=[d1,d2];
    for(let i=2;i<count;i++){
      const side=Math.random()<.42?'front':'back';
      const d=side==='front'?rand(Math.max(frontMin,.30),Math.max(frontMin+.02,.98-(.98-frontMin)*(1-depthScale*.18))):rand(backMin,backMax);
      distances.push(Math.max(d2+.05*depthScale,d));
    }
    distances.sort((a,b)=>a-b);
    distances[0]=d1;distances[1]=d2;
    for(let i=2;i<distances.length;i++)distances[i]=Math.max(distances[i],d2+.08*depthScale+(i-2)*.035*depthScale);

    const anchor=rand(-.12,.12);
    const xs=[anchor-rand(.16,.24),anchor+rand(.16,.24)];
    for(let i=2;i<count;i++)xs.push(rand(-.84,.84));
    for(let i=0;i<count;i++)addVisualObject({distance:distances[i],ndcX:xs[i],ndcY:rand(-.34,.34),angularRadius:THREE.MathUtils.degToRad(rand(5.8,8.2))});
    return {objects,relativeDelta:r,nearestDistance:d1,secondNearestDistance:d2,screenDistance:SCREEN_PLANE_DISTANCE_M,screenDiagonalInches:SCREEN_DIAGONAL_INCHES,adaptive};
  }

  function buildScene(){return buildDepthScene(.10,{count:10,adaptive:false});}
  function buildExperimentScene(relativeDelta=.05,{count=10}={}){return buildDepthScene(relativeDelta,{count,adaptive:true});}

  function setSceneDepth(value){sceneDepth=value;}
  function setFov(value){camera.fov=value;camera.updateProjectionMatrix();updateScreenPlane();}
  function fit(viewer){const r=viewer.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);updateScreenPlane();}
  function removeObject(mesh){objectGroup.remove(mesh);mesh.geometry.dispose();disposeMaterial(mesh.material);objects=objects.filter(o=>o!==mesh);items=items.filter(x=>x.mesh!==mesh);}
  function itemFor(mesh){return items.find(x=>x.mesh===mesh)||null;}function getObjects(){return objects.filter(o=>o.parent&&o.visible);}function getItems(){return items;}

  updateScreenPlane();
  return {THREE,renderer,scene,camera,objectGroup,screenGrid,screenPlaneDistance:SCREEN_PLANE_DISTANCE_M,screenDiagonalInches:SCREEN_DIAGONAL_INCHES,screenGridSwayFraction:SCREEN_GRID_SWAY_FRACTION,buildScene,buildExperimentScene,layout:()=>{},fit,setSceneDepth,setFov,setScreenSway,removeObject,itemFor,getObjects,getItems,makePatternMaterial:(c,r,m,k)=>makePatternMaterial(renderer,c,r,m,k),disposeMaterial};
}