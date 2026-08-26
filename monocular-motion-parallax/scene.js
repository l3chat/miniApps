import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];

const colors=[0xff7a85,0x78c7ff,0x8ee0b1,0xf6c86b,0xb89cff,0xffa66f,0x72e2ef,0xf08cc8,0xa8df65];
const shapes=['sphere','box','torus','cone','cylinder','dodeca','octa','knot'];
const patternKinds=['squares','triangles','checker'];

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
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x09101d,10,34);
  const camera=new THREE.PerspectiveCamera(55,1,.05,80);camera.position.set(0,1.55,5.8);
  const objectGroup=new THREE.Group();scene.add(objectGroup);
  const hemi=new THREE.HemisphereLight(0xdde8ff,0x20304a,1.7),key=new THREE.DirectionalLight(0xffffff,2.6),rim=new THREE.PointLight(0x68a8ff,12,15);key.position.set(3,6,4);key.castShadow=true;rim.position.set(-3,2.5,-1);scene.add(hemi,key,rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,40),new THREE.MeshStandardMaterial({color:0x111a2d,roughness:.82,metalness:.05,transparent:true,opacity:.12,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.set(0,0,-8);scene.add(floor);
  const floorGrid=new THREE.GridHelper(28,56,0x315074,0x22334b);floorGrid.position.set(0,.006,-8);for(const m of (Array.isArray(floorGrid.material)?floorGrid.material:[floorGrid.material])){m.transparent=true;m.opacity=.28;m.depthWrite=false;}scene.add(floorGrid);
  const farZ=-24.2,farSize=120,farDivisions=40;const farWall=new THREE.Mesh(new THREE.PlaneGeometry(farSize,farSize),new THREE.MeshBasicMaterial({color:0x07101e,side:THREE.DoubleSide,fog:false}));farWall.position.set(0,6,farZ-.03);scene.add(farWall);
  const farGrid=new THREE.GridHelper(farSize,farDivisions,0xc1d8ff,0x5d8fca);farGrid.rotation.x=Math.PI/2;farGrid.position.set(0,6,farZ);for(const m of (Array.isArray(farGrid.material)?farGrid.material:[farGrid.material])){m.fog=false;m.transparent=true;m.opacity=.96;m.depthWrite=false;}farGrid.renderOrder=1;scene.add(farGrid);
  for(let i=0;i<11;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(7.5,.018,.02),new THREE.MeshBasicMaterial({color:0x27415f,transparent:true,opacity:.42}));line.position.set(0,.015,.5-i*1.35);scene.add(line);}

  let objects=[],items=[],sceneDepth=2.4;
  function clearObjects(){objectGroup.traverse(o=>{o.geometry?.dispose();disposeMaterial(o.material);});objectGroup.clear();objects=[];items=[];}
  function addObject(type,xT,y,depthT,scale,color,support=false){const geometry=geometryFor(type);geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,makePatternMaterial(renderer,color,.28+Math.random()*.42,Math.random()*.2));mesh.position.set(0,y,0);mesh.scale.setScalar(scale);mesh.rotation.set(Math.random()*.7,Math.random()*Math.PI*2,Math.random()*.4);mesh.castShadow=mesh.receiveShadow=true;objectGroup.add(mesh);objects.push(mesh);let pedestal=null;if(support){pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.38,.48,.12,28),new THREE.MeshStandardMaterial({color:0x283750,roughness:.72}));pedestal.position.set(0,.06,0);objectGroup.add(pedestal);}items.push({mesh,support:pedestal,depthT,xT,manual:false,excluded:false});return mesh;}
  function layout(){const span=Math.max(.5,sceneDepth)*3.6,tanHalf=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));for(const item of items){if(item.manual)continue;const z=.6-item.depthT*span,distance=Math.max(.5,camera.position.z-z),halfW=tanHalf*distance*camera.aspect,radius=(item.mesh.geometry.boundingSphere?.radius||.4)*item.mesh.scale.x,usableHalf=Math.max(.25,halfW*.96-radius*.8),x=item.xT*usableHalf;item.mesh.position.set(x,item.mesh.position.y,z);if(item.support)item.support.position.set(x,.06,z);}}

  function buildScene(){clearObjects();const style=pick(['gallery','floating','corridor','constellation']);const backgrounds={gallery:0x09101d,floating:0x07141a,corridor:0x120d1b,constellation:0x070b16};scene.background=new THREE.Color(backgrounds[style]);floor.material.color.setHex(style==='corridor'?0x1a1324:style==='floating'?0x0c1a1d:0x111a2d);floorGrid.visible=style==='gallery'||style==='corridor';rim.position.set(rand(-5,5),rand(1.8,4.4),rand(-5,0));key.position.set(rand(-6,6),rand(4.5,8),rand(2,7));const count=16+Math.floor(Math.random()*10);for(let i=0;i<count;i++){const depthT=count===1?0:i/(count-1),isNear=i<3,competitorX=()=>rand(-.48,.48);let xT,y,scale,support=false;if(style==='gallery'){xT=isNear?competitorX():rand(-.98,.98);y=rand(.35,3.25);scale=rand(.42,1.08);support=y<.82&&Math.random()<.45;}else if(style==='floating'){xT=isNear?competitorX():rand(-.99,.99);y=rand(.2,4.1);scale=rand(.34,1.02);}else if(style==='corridor'){xT=isNear?competitorX():(i%2?-1:1)*rand(.48,.99);y=rand(.25,3.45);scale=rand(.38,1);support=Math.random()<.2;}else{xT=isNear?competitorX():rand(-.995,.995);y=rand(.15,4.5);scale=rand(.28,.94);}addObject(pick(shapes),xT,y,depthT,scale,pick(colors),support);}layout();return objects;}

  function buildExperimentScene(relativeDelta=.05,{count=10}={}){
    clearObjects();scene.background=new THREE.Color(0x09101d);floorGrid.visible=false;
    const r=Math.max(.002,Math.min(.30,relativeDelta));
    const z1=rand(3.0,6.0),z2=z1*(1+r);
    const distances=[z1,z2];
    for(let i=2;i<count;i++)distances.push(z2+rand(.7,1.8)+(i-2)*rand(.25,.65));
    const xTs=[];const anchor=rand(-.22,.22);xTs.push(anchor-rand(.16,.28),anchor+rand(.16,.28));
    for(let i=2;i<count;i++)xTs.push(rand(-.95,.95));
    const tanHalf=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
    for(let i=0;i<count;i++){
      const distance=distances[i],z=camera.position.z-distance;
      const g=geometryFor(pick(shapes));g.computeBoundingSphere();
      const angularRadius=THREE.MathUtils.degToRad(rand(5.8,8.2));
      const scale=Math.tan(angularRadius)*distance/Math.max(g.boundingSphere?.radius||.35,.001);
      const mesh=new THREE.Mesh(g,makePatternMaterial(renderer,pick(colors),.35+Math.random()*.2,Math.random()*.1));
      const halfW=tanHalf*distance*camera.aspect;
      mesh.position.set(xTs[i]*halfW,rand(.75,2.4),z);mesh.scale.setScalar(scale);mesh.rotation.set(rand(0,.7),rand(0,Math.PI*2),rand(0,.5));objectGroup.add(mesh);objects.push(mesh);items.push({mesh,support:null,depthT:0,xT:0,manual:true,excluded:false});
    }
    return {objects,relativeDelta:r,nearestDistance:z1,secondNearestDistance:z2};
  }

  function setSceneDepth(value){sceneDepth=value;layout();}function setFov(value){camera.fov=value;camera.updateProjectionMatrix();layout();}function fit(viewer){const r=viewer.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);layout();}
  function removeObject(mesh){const item=items.find(x=>x.mesh===mesh);objectGroup.remove(mesh);mesh.geometry.dispose();disposeMaterial(mesh.material);if(item?.support){objectGroup.remove(item.support);item.support.geometry.dispose();disposeMaterial(item.support.material);}objects=objects.filter(o=>o!==mesh);items=items.filter(x=>x.mesh!==mesh);}
  function itemFor(mesh){return items.find(x=>x.mesh===mesh)||null;}function getObjects(){return objects.filter(o=>o.parent&&o.visible);}function getItems(){return items;}

  return {THREE,renderer,scene,camera,objectGroup,floor,floorGrid,key,rim,buildScene,buildExperimentScene,layout,fit,setSceneDepth,setFov,removeObject,itemFor,getObjects,getItems,makePatternMaterial:(c,r,m,k)=>makePatternMaterial(renderer,c,r,m,k),disposeMaterial};
}
