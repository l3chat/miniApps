import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { SCREEN_DIAGONAL_INCHES, VIEWING_DISTANCE_M } from './version.js';

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

const colors=[0xff7a85,0x78c7ff,0x8ee0b1,0xf6c86b,0xb89cff,0xffa66f,0x72e2ef,0xf08cc8,0xa8df65];
const shapes=['sphere','box','torus','cone','cylinder','dodeca','octa','knot'];
const patternKinds=['squares','triangles','checker'];
const SCREEN_DIAGONAL_M=SCREEN_DIAGONAL_INCHES*0.0254;
const EYE_Y=1.55;
const EYE_Z=5.8;

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
function contrastCss(hex){const c=new THREE.Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b>.46?'#10141d':'#ffffff';}

export function makePatternTexture(renderer,baseColor,kind=pick(patternKinds)){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle=colorCss(baseColor);ctx.fillRect(0,0,128,128);ctx.fillStyle=contrastCss(baseColor);
  if(kind==='squares')for(let y=0;y<4;y++)for(let x=0;x<4;x++)ctx.fillRect(x*32+9,y*32+9,14,14);
  else if(kind==='triangles')for(let y=0;y<4;y++)for(let x=0;x<4;x++){const cx=x*32+16,cy=y*32+16,r=11;ctx.beginPath();if((x+y)%2===0){ctx.moveTo(cx,cy-r);ctx.lineTo(cx-r,cy+r);ctx.lineTo(cx+r,cy+r);}else{ctx.moveTo(cx,cy+r);ctx.lineTo(cx-r,cy-r);ctx.lineTo(cx+r,cy-r);}ctx.closePath();ctx.fill();}
  else for(let y=0;y<4;y++)for(let x=0;x<4;x++)if((x+y)%2===0)ctx.fillRect(x*32,y*32,32,32);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.8,1.8);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
}
export function makePatternMaterial(renderer,color,rough=.4,metal=.05,kind){return new THREE.MeshStandardMaterial({color:0xffffff,map:makePatternTexture(renderer,color,kind),roughness:rough,metalness:metal});}
export function disposeMaterial(material){for(const m of (Array.isArray(material)?material:[material])){if(!m)continue;m.map?.dispose();m.dispose?.();}}

export function createWorld(appElement){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;appElement.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x09101d);scene.fog=new THREE.Fog(0x09101d,2,8);
  const camera=new THREE.PerspectiveCamera(55,1,.03,20);camera.position.set(0,EYE_Y,EYE_Z);scene.add(camera);
  const objectGroup=new THREE.Group();scene.add(objectGroup);
  const hemi=new THREE.HemisphereLight(0xdde8ff,0x20304a,1.7),key=new THREE.DirectionalLight(0xffffff,2.6),rim=new THREE.PointLight(0x68a8ff,12,8);key.position.set(3,6,4);rim.position.set(-3,2.5,4.5);scene.add(hemi,key,rim);

  // Ordinary world object: a 10-inch display plane ~30 cm from the eyes.
  const screenGrid=new THREE.GridHelper(1,10,0xd9e8ff,0x78a5d8);screenGrid.rotation.x=Math.PI/2;screenGrid.position.set(0,EYE_Y,EYE_Z-VIEWING_DISTANCE_M);screenGrid.material.transparent=true;screenGrid.material.opacity=.72;screenGrid.material.depthWrite=false;scene.add(screenGrid);

  let objects=[],items=[],sceneDepth=2.4;

  function updateScreenSize(){
    const aspect=Math.max(.2,camera.aspect||1);
    const h=SCREEN_DIAGONAL_M/Math.sqrt(aspect*aspect+1),w=h*aspect;
    screenGrid.scale.set(w,1,h);
  }
  function clearObjects(){objectGroup.traverse(o=>{o.geometry?.dispose();disposeMaterial(o.material);});objectGroup.clear();objects=[];items=[];}
  function worldPoint(ndcX,ndcY,depth){
    const halfH=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth;
    return new THREE.Vector3(ndcX*halfH*camera.aspect,EYE_Y+ndcY*halfH,EYE_Z-depth);
  }
  function addVisualObject({depth,ndcX,ndcY,angularRadius=THREE.MathUtils.degToRad(rand(5.0,7.0)),type=pick(shapes),color=pick(colors)}){
    const geometry=geometryFor(type);geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,makePatternMaterial(renderer,color,.35+Math.random()*.2,Math.random()*.1));
    const scale=Math.tan(angularRadius)*depth/Math.max(geometry.boundingSphere?.radius||.35,.001);
    mesh.position.copy(worldPoint(ndcX,ndcY,depth));mesh.scale.setScalar(scale);mesh.rotation.set(rand(0,.7),rand(0,Math.PI*2),rand(0,.5));objectGroup.add(mesh);objects.push(mesh);items.push({mesh,support:null,manual:true,excluded:false,depth});return mesh;
  }
  function makeSlots(count){
    const base=[[-.72,-.42],[-.36,-.42],[0,-.42],[.36,-.42],[.72,-.42],[-.72,.34],[-.36,.34],[0,.34],[.36,.34],[.72,.34]];
    return shuffle(base).slice(0,count).map(([x,y])=>[x+rand(-.045,.045),y+rand(-.055,.055)]);
  }
  function buildDepthScene(relativeDelta=.06,{count=10,adaptive=false}={}){
    clearObjects();const r=clamp(relativeDelta,.002,.30),spread=clamp(sceneDepth/2.4,.35,1.8);
    const d1=rand(.18,.255),d2=d1*(1+r);const depths=[d1,d2];
    for(let i=2;i<count;i++){
      const behind=Math.random()<.62;
      const d=behind?rand(.34,.60+.22*spread):rand(.20,.285);
      depths.push(Math.max(d2+.018,d));
    }
    depths.sort((a,b)=>a-b);depths[0]=d1;depths[1]=d2;for(let i=2;i<depths.length;i++)depths[i]=Math.max(depths[i],d2+.025+i*.012*spread);
    const slots=makeSlots(count);
    // Keep the two closest competitors reasonably near each other, but clearly separated.
    slots[0]=[-.22+rand(-.05,.05),rand(-.12,.12)];slots[1]=[.22+rand(-.05,.05),rand(-.12,.12)];
    for(let i=0;i<count;i++)addVisualObject({depth:depths[i],ndcX:slots[i][0],ndcY:slots[i][1]});
    return {objects,relativeDelta:r,nearestDistance:d1,secondNearestDistance:d2,screenDistance:VIEWING_DISTANCE_M,screenDiagonalInches:SCREEN_DIAGONAL_INCHES,adaptive};
  }
  function buildScene(){return buildDepthScene(.10,{count:10,adaptive:false});}
  function buildExperimentScene(relativeDelta=.05,{count=10}={}){return buildDepthScene(relativeDelta,{count,adaptive:true});}
  function setSceneDepth(v){sceneDepth=v;}
  function setFov(v){camera.fov=v;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  function fit(viewer){const r=viewer.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.setSize(r.width,r.height,false);updateScreenSize();}
  function removeObject(mesh){objectGroup.remove(mesh);mesh.geometry.dispose();disposeMaterial(mesh.material);objects=objects.filter(o=>o!==mesh);items=items.filter(x=>x.mesh!==mesh);}
  function itemFor(mesh){return items.find(x=>x.mesh===mesh)||null;}
  function getObjects(){return objects.filter(o=>o.parent&&o.visible);}
  function getItems(){return items;}
  updateScreenSize();
  return {THREE,renderer,scene,camera,objectGroup,screenGrid,screenPlaneDistance:VIEWING_DISTANCE_M,screenDiagonalInches:SCREEN_DIAGONAL_INCHES,buildScene,buildExperimentScene,layout:()=>{},fit,setSceneDepth,setFov,removeObject,itemFor,getObjects,getItems,makePatternMaterial:(c,r,m,k)=>makePatternMaterial(renderer,c,r,m,k),disposeMaterial};
}
