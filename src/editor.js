// Nitsud2D — visual editor and lightweight 2D runtime.
// No external dependencies. The editor and playtest share this canvas renderer.
const $ = id => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d');
const holder = $('canvas-holder');
const KEY = 'nitsud2d.project.v1';
const TYPES = [
  {kind:'player',label:'Player',emoji:'🧑'},
  {kind:'tree',label:'Pine tree',emoji:'🌲'},
  {kind:'rock',label:'Rock',emoji:'🪨'},
  {kind:'wolf',label:'Wolf',emoji:'🐺'},
  {kind:'dummy',label:'Training dummy',emoji:'🎯'},
  {kind:'chest',label:'Chest',emoji:'📦'}
];
const allowed = new Set([...TYPES.map(t=>t.kind),'image']);
const id = () => globalThis.crypto?.randomUUID?.() ?? 'e-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const num = (value, fallback, min=-1e6, max=1e6) => Number.isFinite(Number(value)) ? Math.min(max,Math.max(min,Number(value))) : fallback;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const addEntity = (kind,x,y,assetId) => ({id:id(),kind,name:TYPES.find(t=>t.kind===kind)?.label||'Sprite',x:Math.round(x),y:Math.round(y),scale:1,rotation:0,solid:kind!=='player'&&kind!=='image',...(assetId?{assetId}:{})});
function example(){
  const p={format:'nitsud2d',version:1,name:'Whispering Woods',width:1600,height:1000,grid:40,entities:[addEntity('player',765,480)],assets:[]};
  const trees=[[90,120],[210,180],[340,110],[500,90],[690,150],[850,95],[1050,110],[1250,145],[1470,180],[130,360],[120,690],[220,850],[370,900],[590,860],[790,900],[1110,870],[1370,800],[1510,620],[1500,420],[1250,345],[1090,275],[370,320],[490,690]];
  trees.forEach(([x,y])=>p.entities.push(addEntity('tree',x,y)));
  [[470,420],[1150,570],[930,755]].forEach(([x,y])=>p.entities.push(addEntity('rock',x,y)));
  p.entities.push(addEntity('wolf',1010,430),addEntity('dummy',900,580),addEntity('chest',1290,570));
  return p;
}
function validate(raw){
  if(!raw || typeof raw!=='object'||raw.format!=='nitsud2d'||raw.version!==1||typeof raw.name!=='string'||!Array.isArray(raw.entities)||!Array.isArray(raw.assets))throw Error('Not a supported Nitsud2D project.');
  if(raw.entities.length>3000||raw.assets.length>80)throw Error('Project exceeds supported object or asset limit.');
  const p={format:'nitsud2d',version:1,name:raw.name.slice(0,60),width:num(raw.width,1600,320,8192),height:num(raw.height,1000,240,8192),grid:num(raw.grid,40,8,256),entities:[],assets:[]};
  const known=new Set();
  for(const e of raw.entities){
    if(!e||typeof e!=='object'||!allowed.has(e.kind))throw Error('Unsupported scene object.');
    const eid=typeof e.id==='string'?e.id.slice(0,100):id();
    if(known.has(eid))throw Error('Duplicate scene object IDs.');
    known.add(eid);
    p.entities.push({id:eid,kind:e.kind,name:typeof e.name==='string'?e.name.slice(0,100):e.kind,x:num(e.x,0,-10000,10000),y:num(e.y,0,-10000,10000),scale:num(e.scale,1,.1,8),rotation:num(e.rotation,0,-3600,3600),solid:typeof e.solid==='boolean'?e.solid:e.kind!=='player'&&e.kind!=='image',...(typeof e.assetId==='string'?{assetId:e.assetId.slice(0,100)}:{})});
  }
  for(const a of raw.assets){
    if(!a||typeof a.id!=='string'||typeof a.dataUrl!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(a.dataUrl)||a.dataUrl.length>3_000_000)throw Error('Invalid custom sprite.');
    p.assets.push({id:a.id.slice(0,100),name:String(a.name||'Sprite').slice(0,100),dataUrl:a.dataUrl});
  }
  return p;
}
let project;
try { const saved=localStorage.getItem(KEY);project=saved?validate(JSON.parse(saved)):example(); }
catch(e) { console.warn('Could not restore project',e);project=example(); }
const state={selected:null,place:null,playing:false,grid:true,snap:false,debug:false,keys:new Set(),camera:{x:0,y:0,zoom:1},drag:null,space:false,preview:null,pointer:{x:0,y:0},images:new Map(),saveTimer:null,message:'Ready to build.',lastFrame:performance.now()};
function notify(message){
  state.message=message;$('status-message').textContent=message;
  const t=$('toast');t.textContent=message;t.classList.add('show');
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),2300);
}
function save(silent=false){
  try{localStorage.setItem(KEY,JSON.stringify(project));if(!silent)notify('Project saved in this browser.');return true;}
  catch(e){if(!silent)notify('Browser storage is full. Use Export to back up your project.');console.warn(e);return false;}
}
function changed(){
  clearTimeout(state.saveTimer);
  state.saveTimer=setTimeout(()=>save(true),350);
  $('entity-count').textContent=project.entities.length+' objects';
  $('scene-info').textContent=project.name+' • '+project.width+' × '+project.height;
}
function selected(){return project.entities.find(e=>e.id===state.selected)||null;}
function reinitCamera(){
  const w=holder.clientWidth||900,h=holder.clientHeight||600;
  state.camera.zoom=clamp(Math.min(w/project.width,h/project.height)*.91,.12,2);
  state.camera.x=(w-project.width*state.camera.zoom)/2;
  state.camera.y=(h-project.height*state.camera.zoom)/2;
  $('zoom-display').textContent=Math.round(state.camera.zoom*100)+'%';
}
function refreshImages(){
  state.images.clear();
  for(const a of project.assets){
    const image=new Image();image.src=a.dataUrl;
    image.onload=()=>{ if(project.assets.some(asset=>asset.id===a.id))state.images.set(a.id,image);};
  }
}
function setProject(next){
  project=validate(next);state.selected=null;state.place=null;state.playing=false;state.preview=null;state.keys.clear();refreshImages();reinitCamera();refresh();changed();save(true);
}
function refresh(){
  $('project-name').value=project.name;
  $('world-width').value=project.width;$('world-height').value=project.height;$('grid-size').value=project.grid;
  $('play-btn').textContent=state.playing?'■ Stop':'▶ Play';
  $('play-btn').classList.toggle('primary',!state.playing);
  $('mode').textContent=state.playing?'● PLAY MODE':'● EDIT MODE';
  $('mode').classList.toggle('playing',state.playing);
  $('play-info').hidden=!state.playing;
  $('scene-instructions').textContent=state.playing?'Playtesting • WASD or arrows to move • Stop to edit':state.place?'Click on the world to place '+state.place.kind+' • Esc to cancel':'Select or drag objects • Wheel zoom • Space + drag pan';
  $('grid-toggle').checked=state.grid;$('snap-toggle').checked=state.snap;$('debug-toggle').checked=state.debug;
  $('delete-btn').disabled=$('duplicate-btn').disabled=state.playing||!selected();
  renderHierarchy();renderPalette();renderInspector();renderAssets();
}
const escapeHTML=str=>String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconFor=e=>e.kind==='image'?'🖼️':TYPES.find(t=>t.kind===e.kind)?.emoji||'◆';
function renderHierarchy(){
  const list=$('scene-list');list.innerHTML='';
  for(const e of project.entities){
    const btn=document.createElement('button');btn.className='scene-item'+(state.selected===e.id?' selected':'');
    btn.innerHTML='<span>'+iconFor(e)+'</span><span>'+escapeHTML(e.name)+'</span><small>'+Math.round(e.x)+','+Math.round(e.y)+'</small>';
    btn.onclick=()=>{if(!state.playing){state.selected=e.id;state.place=null;refresh();}};
    list.appendChild(btn);
  }
  $('entity-count').textContent=project.entities.length+' objects';
}
function renderPalette(){
  const root=$('palette');root.innerHTML='';
  for(const type of TYPES){
    const btn=document.createElement('button');btn.className='tile'+(state.place?.kind===type.kind?' active':'');
    btn.innerHTML='<span class="emoji">'+type.emoji+'</span><span>'+type.label+'</span>';
    btn.disabled=state.playing;btn.onclick=()=>{state.place=state.place?.kind===type.kind?null:{kind:type.kind};state.selected=null;refresh();};
    root.appendChild(btn);
  }
  $('placement-hint').textContent=state.place?'Click the map to place '+state.place.kind+'. Press Escape to stop.':'Click to select, drag to reposition.';
}
function renderAssets(){
  const list=$('asset-list');list.innerHTML='';
  if(!project.assets.length){list.innerHTML='<p class="empty-message">No custom sprites yet.</p>';return;}
  for(const a of project.assets){
    const row=document.createElement('div');row.className='asset-row';
    const img=document.createElement('img');img.src=a.dataUrl;img.alt='';
    const name=document.createElement('span');name.textContent=a.name;name.title=a.name;
    const button=document.createElement('button');button.className='btn tiny';button.textContent='Place';button.disabled=state.playing;
    button.onclick=()=>{state.place={kind:'image',assetId:a.id};state.selected=null;refresh();};
    row.append(img,name,button);list.appendChild(row);
  }
}
function renderInspector(){
  const root=$('inspector-content'),e=selected();
  $('selection-type').textContent=e?e.kind.toUpperCase():'';
  if(!e){root.innerHTML='<div class="inspector-empty">↖<br>Select an object in the world or scene hierarchy to edit its properties.</div>';return;}
  root.innerHTML='<label class="field">Object name<input data-field="name" maxlength="100"></label>'+
    '<label class="field">Type<select disabled><option>'+escapeHTML(e.kind)+'</option></select></label>'+
    '<div class="two"><label class="field">Position X<input data-field="x" type="number" step="1"></label><label class="field">Position Y<input data-field="y" type="number" step="1"></label></div>'+
    '<div class="two"><label class="field">Scale<input data-field="scale" type="number" min=".1" max="8" step=".1"></label><label class="field">Rotation °<input data-field="rotation" type="number" step="5"></label></div>'+
    '<label class="check"><input data-field="solid" type="checkbox"> Solid collision</label>'+
    '<p class="hint">The cyan outline marks the selected object. Solid collision prevents the player moving through it in Play mode.</p>';
  for(const field of ['name','x','y','scale','rotation','solid']){
    const el=root.querySelector('[data-field="'+field+'"]');
    if(field==='solid')el.checked=!!e.solid;else el.value=e[field];
    el.addEventListener('change',()=>{
      if(field==='name')e.name=String(el.value).slice(0,100)||'Object';
      else if(field==='solid')e.solid=el.checked;
      else e[field]=num(el.value,e[field],field==='scale'?.1:-10000,field==='scale'?8:10000);
      if(field==='rotation')e.rotation=((e.rotation%360)+360)%360;
      changed();refresh();
    });
  }
}
function selectEntity(e){state.selected=e?.id||null;refresh();}
function deleteSelected(){
  if(state.playing||!selected())return;
  project.entities=project.entities.filter(e=>e.id!==state.selected);state.selected=null;changed();refresh();notify('Object deleted.');
}
function duplicateSelected(){
  const e=selected();if(!e||state.playing)return;
  const copy={...e,id:id(),name:e.name+' copy',x:clamp(e.x+40,0,project.width),y:clamp(e.y+40,0,project.height)};
  project.entities.push(copy);state.selected=copy.id;changed();refresh();notify('Object duplicated.');
}
function place(x,y){
  if(!state.place)return;
  const px=state.snap?Math.round(x/project.grid)*project.grid:x,py=state.snap?Math.round(y/project.grid)*project.grid:y;
  const e=addEntity(state.place.kind,clamp(px,0,project.width),clamp(py,0,project.height),state.place.assetId);
  project.entities.push(e);state.selected=e.id;changed();renderHierarchy();renderInspector();notify('Placed '+e.name+'.');
}
const worldPos=(sx,sy)=>({x:(sx-state.camera.x)/state.camera.zoom,y:(sy-state.camera.y)/state.camera.zoom});
const screenPos=(x,y)=>({x:x*state.camera.zoom+state.camera.x,y:y*state.camera.zoom+state.camera.y});
function mousePos(ev){const r=canvas.getBoundingClientRect();return{x:ev.clientX-r.left,y:ev.clientY-r.top};}
function dimension(e){
  if(e.kind==='tree')return {w:70,h:124,top:-124,bottom:12,r:19};
  if(e.kind==='rock')return {w:68,h:52,top:-48,bottom:8,r:27};
  if(e.kind==='player')return {w:38,h:78,top:-74,bottom:8,r:14};
  if(e.kind==='wolf')return {w:74,h:66,top:-64,bottom:10,r:22};
  if(e.kind==='dummy')return {w:65,h:90,top:-86,bottom:8,r:15};
  if(e.kind==='chest')return {w:58,h:52,top:-50,bottom:8,r:25};
  const img=state.images.get(e.assetId);const ratio=img?Math.min(96/img.width,96/img.height,2):1;
  return {w:img?img.width*ratio:64,h:img?img.height*ratio:64,top:img?-img.height*ratio: -64,bottom:0,r:22};
}
function hitTest(x,y){
  for(const e of [...project.entities].reverse().sort((a,b)=>b.y-a.y)){
    const d=dimension(e),s=e.scale;
    const local=unrotate(x-e.x,y-e.y,e.rotation*Math.PI/180);
    if(Math.abs(local.x)<d.w*s*.55 && local.y>d.top*s-8&&local.y<d.bottom*s+7)return e;
  }
  return null;
}
function unrotate(x,y,a){return{x:x*Math.cos(a)+y*Math.sin(a),y:-x*Math.sin(a)+y*Math.cos(a)};}
function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function drawEntity(e){
  const d=dimension(e);
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation*Math.PI/180);ctx.scale(e.scale,e.scale);
  ellipse(0,4,d.r*1.4,9,'#102a20aa');
  switch(e.kind){
    case 'tree':
      roundedRect(-7,-40,14,47,3,'#73543a');
      polygon([[0,-126],[-41,-31],[41,-31]],'#214636');
      polygon([[0,-141],[-36,-59],[36,-59]],'#2c6648');
      polygon([[0,-152],[-29,-88],[29,-88]],'#42835b');
      polygon([[-5,-137],[-22,-101],[1,-101]],'#6aab78');
      break;
    case 'rock':
      polygon([[-34,-7],[-23,-37],[9,-46],[35,-14],[27,2],[-26,4]],'#586573');
      polygon([[-23,-37],[9,-46],[1,-19],[-31,-12]],'#96a4ad');break;
    case 'player':
      roundedRect(-12,-19,10,25,3,'#273a54');roundedRect(3,-19,10,25,3,'#273a54');
      roundedRect(-18,-48,36,36,6,'#326090');roundedRect(-19,-42,7,29,3,'#26394f');roundedRect(12,-42,7,29,3,'#26394f');
      roundedRect(-13,-70,26,27,8,'#dba77c');roundedRect(-15,-73,30,12,5,'#46352e');
      roundedRect(-7,-58,3,3,1,'#152539');roundedRect(5,-58,3,3,1,'#152539');
      roundedRect(21,-57,5,37,2,'#c7e0f1');roundedRect(14,-33,19,5,1,'#8b6849');break;
    case 'wolf':
      ellipse(-1,-24,29,19,'#647078');polygon([[9,-33],[33,-41],[38,-22]],'#7f8991');
      polygon([[14,-38],[20,-69],[32,-42]],'#3e4851');polygon([[29,-38],[42,-64],[43,-31]],'#46505b');
      ellipse(33,-22,16,11,'#bac1b4');ellipse(31,-42,3,3,'#edc976');
      roundedRect(-21,-13,10,19,2,'#45515d');roundedRect(10,-13,9,19,2,'#45515d');break;
    case 'dummy':
      roundedRect(-5,-82,10,91,2,'#705036');ellipse(0,-85,16,16,'#bd9567');
      roundedRect(-19,-65,38,42,4,'#a47b4d');roundedRect(-32,-51,64,9,2,'#644c36');
      ctx.lineWidth=4;ctx.strokeStyle='#654729';ctx.beginPath();ctx.arc(0,-43,11,0,Math.PI*2);ctx.stroke();break;
    case 'chest':
      roundedRect(-28,-32,56,36,3,'#643b20');roundedRect(-29,-42,58,17,5,'#b07c43');
      roundedRect(-6,-42,12,45,1,'#e1b267');roundedRect(-3,-21,6,8,2,'#52391e');break;
    case 'image': {
      const img=state.images.get(e.assetId);
      if(img){const ratio=Math.min(96/img.width,96/img.height,2);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,-img.width*ratio/2,-img.height*ratio,img.width*ratio,img.height*ratio);}
      else{roundedRect(-32,-64,64,64,7,'#466785');polygon([[-24,-8],[0,-42],[26,-8]],'#a6c9e6');}
    }
  }
  ctx.restore();
}
function drawWorld(){
  const w=project.width,h=project.height;
  ctx.fillStyle='#607e57';ctx.fillRect(0,0,w,h);
  // Stable, repeatable patches of vegetation.
  for(let i=0;i<390;i++){
    const x=(i*389+57)%w,y=(i*197+91)%h;
    ellipse(x,y,10+i%7*3,3+i%4*2,i%3?'#4d714942':'#9cba7940');
  }
  // Dirt path with a soft edging.
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-40,470);ctx.bezierCurveTo(240,340,410,550,780,468);ctx.bezierCurveTo(1140,400,1300,550,1640,420);
  ctx.strokeStyle='#907957';ctx.lineWidth=105;ctx.stroke();
  ctx.strokeStyle='#b29a73';ctx.lineWidth=80;ctx.stroke();
  if(state.grid){
    ctx.beginPath();ctx.strokeStyle='#f5ffe51c';ctx.lineWidth=1/state.camera.zoom;
    for(let x=0;x<=w;x+=project.grid){ctx.moveTo(x,0);ctx.lineTo(x,h);}
    for(let y=0;y<=h;y+=project.grid){ctx.moveTo(0,y);ctx.lineTo(w,y);}
    ctx.stroke();
  }
  ctx.strokeStyle='#93b6b0';ctx.lineWidth=2/state.camera.zoom;ctx.strokeRect(0,0,w,h);
}
function render(){
  const pixelRatio=Math.min(devicePixelRatio||1,2),width=holder.clientWidth,height=holder.clientHeight;
  if(!width||!height)return;
  const targetW=Math.round(width*pixelRatio),targetH=Math.round(height*pixelRatio);
  if(canvas.width!==targetW||canvas.height!==targetH){canvas.width=targetW;canvas.height=targetH;}
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#0e1720';ctx.fillRect(0,0,width,height);
  ctx.translate(state.camera.x,state.camera.y);ctx.scale(state.camera.zoom,state.camera.zoom);
  ctx.save();ctx.beginPath();ctx.rect(0,0,project.width,project.height);ctx.clip();
  drawWorld();
  for(const e of [...project.entities].sort((a,b)=>a.y-b.y)){
    const display=state.playing&&e.kind==='player'&&state.preview?.id===e.id?{...e,...state.preview}:e;
    drawEntity(display);
    if(state.debug&&e.solid){
      const d=dimension(display);ctx.beginPath();ctx.arc(display.x,display.y-4,d.r*display.scale,0,Math.PI*2);
      ctx.strokeStyle='#ffc772';ctx.lineWidth=2/state.camera.zoom;ctx.stroke();
    }
  }
  ctx.restore();
  if(!state.playing){
    const e=selected();if(e){
      const d=dimension(e);ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation*Math.PI/180);
      ctx.strokeStyle='#87d3ff';ctx.lineWidth=2/state.camera.zoom;ctx.setLineDash([7/state.camera.zoom,4/state.camera.zoom]);
      ctx.strokeRect(-d.w*e.scale/2,d.top*e.scale,d.w*e.scale,(d.bottom-d.top)*e.scale);
      ctx.setLineDash([]);ellipse(0,12,4/state.camera.zoom,4/state.camera.zoom,'#87d3ff');ctx.restore();
    }
    if(state.place){
      const p=state.pointer;
      if(p.x>=0&&p.y>=0&&p.x<project.width&&p.y<project.height){
        ctx.globalAlpha=.52;drawEntity(addEntity(state.place.kind,p.x,p.y,state.place.assetId));ctx.globalAlpha=1;
      }
    }
  }
}
function collisionRadius(e){return dimension(e).r*e.scale;}
function isBlocked(x,y,player){
  if(x<15||y<15||x>project.width-15||y>project.height-15)return true;
  return project.entities.some(e=>e.id!==player.id&&e.solid&&Math.hypot(x-e.x,y-e.y)<collisionRadius(e)+15);
}
function update(dt){
  if(!state.playing||!state.preview)return;
  const player=project.entities.find(e=>e.id===state.preview.id);if(!player)return;
  const k=state.keys,dx=Number(k.has('arrowright')||k.has('d'))-Number(k.has('arrowleft')||k.has('a'));
  const dy=Number(k.has('arrowdown')||k.has('s'))-Number(k.has('arrowup')||k.has('w'));
  if(!dx&&!dy)return;
  const size=Math.hypot(dx,dy),speed=205*Math.min(dt,.05);
  const mx=dx/size*speed,my=dy/size*speed;
  if(!isBlocked(state.preview.x+mx,state.preview.y,player))state.preview.x+=mx;
  if(!isBlocked(state.preview.x,state.preview.y+my,player))state.preview.y+=my;
}
function tick(t){
  const dt=Math.max(0,Math.min((t-state.lastFrame)/1000,.05));state.lastFrame=t;
  update(dt);render();requestAnimationFrame(tick);
}
function togglePlay(){
  if(!state.playing){
    const player=project.entities.find(e=>e.kind==='player');
    if(!player){notify('Add a Player first to test movement.');return;}
    state.preview={id:player.id,x:player.x,y:player.y};state.playing=true;state.place=null;state.selected=null;
    notify('Play mode active. Use WASD or arrow keys.');
  }else{
    state.playing=false;state.preview=null;state.keys.clear();notify('Back to edit mode.');
  }
  refresh();
}
canvas.addEventListener('pointerdown',ev=>{
  if(ev.button!==0&&ev.button!==1)return;
  canvas.setPointerCapture(ev.pointerId);
  const m=mousePos(ev),p=worldPos(m.x,m.y);state.pointer=p;
  if(ev.button===1||state.space){state.drag={type:'pan',x:m.x,y:m.y,cx:state.camera.x,cy:state.camera.y};return;}
  if(state.playing)return;
  if(state.place){if(p.x>=0&&p.x<=project.width&&p.y>=0&&p.y<=project.height)place(p.x,p.y);return;}
  const e=hitTest(p.x,p.y);selectEntity(e);
  if(e){state.drag={type:'entity',id:e.id,dx:p.x-e.x,dy:p.y-e.y,moved:false};canvas.classList.add('grabbing');}
});
canvas.addEventListener('pointermove',ev=>{
  const m=mousePos(ev),p=worldPos(m.x,m.y);state.pointer=p;
  $('cursor-position').textContent='X: '+Math.round(p.x)+'   Y: '+Math.round(p.y);
  if(!state.drag)return;
  if(state.drag.type==='pan'){state.camera.x=state.drag.cx+m.x-state.drag.x;state.camera.y=state.drag.cy+m.y-state.drag.y;return;}
  const e=project.entities.find(e=>e.id===state.drag.id);if(!e||state.playing)return;
  let x=p.x-state.drag.dx,y=p.y-state.drag.dy;
  if(state.snap){x=Math.round(x/project.grid)*project.grid;y=Math.round(y/project.grid)*project.grid;}
  const nx=clamp(Math.round(x),0,project.width),ny=clamp(Math.round(y),0,project.height);
  if(nx!==e.x||ny!==e.y){e.x=nx;e.y=ny;state.drag.moved=true;}
});
function endDrag(){
  if(state.drag?.moved){changed();renderHierarchy();renderInspector();}
  state.drag=null;canvas.classList.remove('grabbing');
}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('wheel',ev=>{
  ev.preventDefault();const m=mousePos(ev),world=worldPos(m.x,m.y),factor=ev.deltaY<0?1.12:1/1.12;
  state.camera.zoom=clamp(state.camera.zoom*factor,.1,4);
  state.camera.x=m.x-world.x*state.camera.zoom;state.camera.y=m.y-world.y*state.camera.zoom;
  $('zoom-display').textContent=Math.round(state.camera.zoom*100)+'%';
},{passive:false});
canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
window.addEventListener('keydown',ev=>{
  const editable=ev.target instanceof HTMLElement&&!!ev.target.closest('input,textarea,select,[contenteditable]');
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();save();return;}
  if(editable)return;
  const key=ev.key.toLowerCase();state.keys.add(key);
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))ev.preventDefault();
  if(key===' ')state.space=true;
  if(key==='escape'){state.place=null;if(state.playing)togglePlay();else{state.selected=null;refresh();}refresh();}
  if(!state.playing&&['delete','backspace'].includes(key))deleteSelected();
  if(!state.playing&&(ev.ctrlKey||ev.metaKey)&&key==='d'){ev.preventDefault();duplicateSelected();}
});
window.addEventListener('keyup',ev=>{state.keys.delete(ev.key.toLowerCase());if(ev.key===' ')state.space=false;});
window.addEventListener('blur',()=>{state.keys.clear();state.space=false;endDrag();});
function download(filename,data,mime){
  const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$('save-btn').onclick=()=>save();
$('export-btn').onclick=()=>{
  save(true);download((project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'world')+'.nitsud2d.json',JSON.stringify(project,null,2),'application/json');notify('Project exported as JSON.');
};
$('new-btn').onclick=()=>{
  if(!confirm('Create a new project? Your current project is autosaved, but export it first if you want a separate backup.'))return;
  setProject({format:'nitsud2d',version:1,name:'Untitled World',width:1600,height:1000,grid:40,entities:[addEntity('player',800,500)],assets:[]});notify('New world created.');
};
$('import-btn').onclick=()=>$('project-input').click();
$('project-input').addEventListener('change',async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  try{if(file.size>15000000)throw Error('Project file is too large (15 MB limit).');const imported=validate(JSON.parse(await file.text()));setProject(imported);notify('Opened '+project.name+'.');}
  catch(e){notify('Could not open project: '+e.message);}
  ev.target.value='';
});
$('upload-btn').onclick=()=>$('sprite-input').click();
$('sprite-input').addEventListener('change',async ev=>{
  const files=[...(ev.target.files||[])];
  for(const file of files){
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>2*1024*1024){notify('Image must be PNG, JPEG, WebP or GIF under 2 MB.');continue;}
    if(project.assets.length>=80){notify('Project sprite limit reached (80).');break;}
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('File read error'));r.readAsDataURL(file);});
      project.assets.push({id:id(),name:file.name.slice(0,100),dataUrl});changed();refreshImages();refresh();notify('Added '+file.name+'. Select Place to use it.');
    }catch(e){notify('Could not import '+file.name);}
  }
  ev.target.value='';
});
$('play-btn').onclick=togglePlay;$('delete-btn').onclick=deleteSelected;$('duplicate-btn').onclick=duplicateSelected;
$('fit-btn').onclick=reinitCamera;
function zoom(factor){const m={x:holder.clientWidth/2,y:holder.clientHeight/2},p=worldPos(m.x,m.y);state.camera.zoom=clamp(state.camera.zoom*factor,.1,4);state.camera.x=m.x-p.x*state.camera.zoom;state.camera.y=m.y-p.y*state.camera.zoom;$('zoom-display').textContent=Math.round(state.camera.zoom*100)+'%';}
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);
for(const [name,prop] of [['grid-toggle','grid'],['snap-toggle','snap'],['debug-toggle','debug']])$(name).addEventListener('change',ev=>state[prop]=ev.target.checked);
$('project-name').addEventListener('change',ev=>{project.name=ev.target.value.trim().slice(0,60)||'Untitled World';changed();refresh();});
for(const [name,key,min,max] of [['world-width','width',320,8192],['world-height','height',240,8192],['grid-size','grid',8,256]]){
  $(name).addEventListener('change',ev=>{project[key]=Math.round(num(ev.target.value,project[key],min,max));changed();refresh();});
}
$('help-btn').onclick=()=>$('help-modal').classList.add('open');
$('close-help').onclick=()=>$('help-modal').classList.remove('open');
$('help-modal').onclick=ev=>{if(ev.target===$('help-modal'))$('help-modal').classList.remove('open');};
window.addEventListener('resize',()=>render());
refreshImages();reinitCamera();refresh();requestAnimationFrame(tick);
